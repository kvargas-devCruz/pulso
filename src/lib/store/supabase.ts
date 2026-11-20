// Almacenamiento en Supabase (fuente de verdad en producción, ADR-0001).
// Usa la service role key: solo se ejecuta en el servidor (rutas API).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Action, Alert, Company, EmailRecord, Extraction, LearnedRule, Run, WhatsAppMessage } from "../types";
import { DEFAULT_COMPANY, type Store } from "./types";

type Row = { data: unknown };

export class SupabaseStore implements Store {
  kind = "supabase" as const;
  private db: SupabaseClient;
  private companyId: string | null = null;

  constructor(
    url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY!,
    private company: Company = DEFAULT_COMPANY,
  ) {
    this.db = createClient(url, key, { auth: { persistSession: false } });
  }

  private async findCompany(): Promise<string | null> {
    const found = await this.db.from("companies").select("id").eq("tax_id", this.company.taxId).maybeSingle();
    if (found.error) throw found.error;
    return (found.data?.id as string | undefined) ?? null;
  }

  private async cid(): Promise<string> {
    if (this.companyId) return this.companyId;
    const existing = await this.findCompany();
    if (existing) return (this.companyId = existing);
    const c = this.company;
    const created = await this.db
      .from("companies")
      .insert({ name: c.name, tax_id: c.taxId, owner_whatsapp: c.ownerWhatsapp, notify_level: c.notifyLevel })
      .select("id")
      .single();
    // Otra instancia (serverless) pudo crearla al mismo tiempo: unique(tax_id) → leerla.
    if (created.error?.code === "23505") {
      const again = await this.findCompany();
      if (again) return (this.companyId = again);
    }
    if (created.error) throw created.error;
    return (this.companyId = created.data.id as string);
  }

  private async all<T>(table: string, order?: string): Promise<T[]> {
    let q = this.db.from(table).select("data").eq("company_id", await this.cid());
    if (order) q = q.order(order, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    return (data as Row[]).map((r) => r.data as T);
  }
  private async upsert(table: string, rows: Record<string, unknown>[], onConflict?: string) {
    if (!rows.length) return;
    const { error } = await this.db.from(table).upsert(rows, onConflict ? { onConflict } : undefined);
    if (error) throw error;
  }

  async getCompany(): Promise<Company> {
    const { data, error } = await this.db.from("companies").select("*").eq("id", await this.cid()).single();
    if (error) throw error;
    return { name: data.name, taxId: data.tax_id, ownerWhatsapp: data.owner_whatsapp ?? DEFAULT_COMPANY.ownerWhatsapp, notifyLevel: data.notify_level };
  }
  async saveCompany(c: Company) {
    const { error } = await this.db.from("companies").update({ name: c.name, owner_whatsapp: c.ownerWhatsapp, notify_level: c.notifyLevel }).eq("id", await this.cid());
    if (error) throw error;
  }

  listEmails() { return this.all<EmailRecord>("emails", "received_at"); }
  async addEmails(emails: EmailRecord[]) {
    const company_id = await this.cid();
    const existing = new Set((await this.listEmails()).map((e) => `${e.source}:${e.externalId}`));
    const fresh = emails.filter((e) => !existing.has(`${e.source}:${e.externalId}`));
    await this.upsert("emails", fresh.map((e) => ({
      id: e.id, company_id, run_id: e.runId, source: e.source, external_id: e.externalId, sender: e.sender,
      subject: e.subject, received_at: e.receivedAt, content_hash: e.contentHash, data: e,
    })));
    return fresh;
  }

  listExtractions() { return this.all<Extraction>("extractions"); }
  async upsertExtractions(list: Extraction[]) {
    const company_id = await this.cid();
    await this.upsert("extractions", list.map((x) => ({
      email_id: x.emailId, company_id, category: x.category, kind: x.kind, counterparty: x.counterparty,
      counterparty_tax_id: x.counterpartyTaxId, numeric_key: x.invoice?.numericKey ?? null, doc_number: x.invoice?.docNumber ?? null,
      amount: x.amount, due_date: x.dueDate, status: x.status, hacienda_status: x.haciendaStatus, amount_source: x.amountSource, data: x,
    })), "email_id");
  }

  listAlerts() { return this.all<Alert>("alerts", "analyzed_at"); }
  async upsertAlerts(list: Alert[]) {
    const company_id = await this.cid();
    await this.upsert("alerts", list.map((a) => ({
      id: a.id, company_id, key: a.key, type: a.type, confidence: a.confidence, status: a.status,
      amount_at_risk: a.amountAtRisk, analyzed_at: a.analyzedAt, data: a,
    })));
  }

  listRules() { return this.all<LearnedRule>("learned_rules", "created_at"); }
  async upsertRule(r: LearnedRule) {
    await this.upsert("learned_rules", [{ id: r.id, company_id: await this.cid(), alert_type: r.alertType, counterparty_tax_id: r.counterpartyTaxId, active: r.active, created_at: r.createdAt, data: r }]);
  }
  async deleteRule(id: string) {
    const { error } = await this.db.from("learned_rules").delete().eq("id", id).eq("company_id", await this.cid());
    if (error) throw error;
  }

  listActions() { return this.all<Action>("actions", "created_at"); }
  async upsertAction(a: Action) {
    await this.upsert("actions", [{ id: a.id, company_id: await this.cid(), alert_id: a.alertId, status: a.status, approved_via: a.approvedVia, created_at: a.createdAt, data: a }]);
  }

  listMessages() { return this.all<WhatsAppMessage>("whatsapp_messages", "created_at"); }
  async addMessage(m: WhatsAppMessage) {
    await this.upsert("whatsapp_messages", [{ id: m.id, company_id: await this.cid(), direction: m.direction, status: m.status, created_at: m.createdAt, data: m }]);
  }

  listRuns() { return this.all<Run>("runs", "started_at"); }
  async saveRun(r: Run) {
    await this.upsert("runs", [{ id: r.id, company_id: await this.cid(), source: r.source, label: r.label, started_at: r.startedAt, finished_at: r.finishedAt, data: r }]);
  }

  async reset() {
    const company_id = await this.cid();
    for (const t of ["whatsapp_messages", "actions", "alerts", "learned_rules", "extractions", "emails", "runs"]) {
      const { error } = await this.db.from(t).delete().eq("company_id", company_id);
      if (error) throw error;
    }
  }
}
