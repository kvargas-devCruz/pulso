// El único flujo central de Pulso (ADR-0001):
// adaptador → guardar correo + hash → extraer → validar Hacienda → clasificar → reglas
// (filtradas por lo aprendido) → explicar → acciones → notificar → bitácora.
import { createHash } from "crypto";
import type { Action, Alert, AlertDraft, EmailRecord, Extraction, HaciendaMessage, LearnedRule, LogStep, Run, WhatsAppMessage } from "../types";
import type { Store } from "../store";
import type { SourceAdapter } from "../ingest";
import { extractEmail, haciendaMessagesFromEmail, invoicesFromEmail, senderDomain, type Contact, type ExtractContext } from "./extract";
import { learnedConditionFor, matchLearnedRule, runRules, type Doc } from "./rules";
import { actionEmailId, draftAction, explain, whatsappAlertText, alertTitle } from "./explain";
import { sendWhatsApp } from "../notify/whatsapp";
import { colones, plural, todayCR } from "../format";
import { answerQuestion, type AskAnswer } from "./ask";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const nowIso = () => new Date().toISOString();
const id = (prefix: string, seed: string) => `${prefix}_${sha(seed).slice(0, 12)}`;

export function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export function joinDocs(emails: EmailRecord[], exts: Extraction[]): Doc[] {
  const byId = new Map(exts.map((x) => [x.emailId, x]));
  return emails
    .filter((e) => byId.has(e.id))
    .map((e) => ({ email: e, ext: byId.get(e.id)! }))
    .sort((a, b) => a.email.receivedAt.localeCompare(b.email.receivedAt));
}

function buildContext(emails: EmailRecord[], companyTaxId: string, today: string): ExtractContext {
  const contacts: Contact[] = [];
  const haciendaByKey = new Map<string, HaciendaMessage>();
  for (const e of emails) {
    for (const inv of invoicesFromEmail(e)) {
      const domain = senderDomain(e.sender);
      if (inv.issuerTaxId !== companyTaxId && !contacts.some((c) => c.domain === domain))
        contacts.push({ name: inv.issuerName, taxId: inv.issuerTaxId, domain });
    }
    for (const m of haciendaMessagesFromEmail(e)) haciendaByKey.set(m.numericKey, m);
  }
  return { companyTaxId, today, contacts, haciendaByKey };
}

export interface IngestResult {
  run: Run;
  newEmails: number;
  newAlerts: Alert[];
  notified: WhatsAppMessage | null;
}

/**
 * Tope diario de WhatsApp (ADR-0005, sin spam): alertas y resúmenes enviados de verdad en las
 * últimas 24 h. Las respuestas a lo que el dueño escribe no cuentan.
 */
export async function sendCapped(store: Store, body: string): Promise<{ status: WhatsAppMessage["status"]; sid?: string; error?: string }> {
  const cap = Number(process.env.PULSO_WHATSAPP_DAILY_CAP ?? 100);
  const since = Date.now() - 24 * 3600_000;
  const sent = (await store.listMessages()).filter(
    (m) => m.direction === "saliente" && m.kind !== "respuesta" && m.status === "enviado" && Date.parse(m.createdAt) >= since,
  ).length;
  if (sent >= cap) return { status: "tope_diario" };
  return sendWhatsApp(body);
}

export async function runIngest(store: Store, adapter: SourceAdapter, today: string): Promise<IngestResult> {
  const company = await store.getCompany();
  const runId = `run_${Date.now()}`;
  const run: Run = { id: runId, source: adapter.source, label: adapter.label, startedAt: nowIso(), finishedAt: null, steps: [], headline: "" };
  const step = (s: string, detail: string, count: number | null = null) => run.steps.push({ step: s, detail, count } as LogStep);

  // 1. Leer
  const raw = await adapter.fetchEmails();
  const records: EmailRecord[] = raw.map((r) => ({
    ...r,
    id: `${r.source}-${r.externalId}`,
    runId,
    contentHash: sha(r.subject + "\n" + r.body + "\n" + r.attachments.map((a) => a.content ?? a.name).join("\n")),
  }));
  const fresh = await store.addEmails(records);
  const allEmails = await store.listEmails();
  step("leer", `Leí ${plural(fresh.length, "correo nuevo", "correos nuevos")} (${allEmails.length} en total).`, fresh.length);

  // 2. Extraer (XML con código; resto con Claude o heurística)
  const ctx = buildContext(allEmails, company.taxId, today);
  const newExts = await mapLimit(fresh, 4, (e) => extractEmail(e, ctx));
  // Una respuesta de Hacienda puede llegar en otro correo: actualizar todas las facturas.
  const prevExts = await store.listExtractions();
  const refreshed = prevExts
    .filter((x) => x.invoice && x.haciendaStatus === "sin_respuesta" && ctx.haciendaByKey.has(x.invoice.numericKey))
    .map((x) => {
      const m = ctx.haciendaByKey.get(x.invoice!.numericKey)!;
      return { ...x, haciendaStatus: m.status, haciendaDetail: m.detail } as Extraction;
    });
  await store.upsertExtractions([...newExts, ...refreshed]);
  const freshInvoices = newExts.filter((x) => x.invoice);
  const byClaude = newExts.filter((x) => x.extractedBy === "claude").length;
  step("extraer", `Encontré ${plural(freshInvoices.length, "factura electrónica", "facturas electrónicas")} (leídas del XML) y entendí ${plural(newExts.length - freshInvoices.length, "correo más", "correos más")}${byClaude ? ` (${byClaude} con Claude)` : ""}.`, freshInvoices.length);

  const acc = freshInvoices.filter((x) => x.haciendaStatus === "aceptado").length;
  const rej = freshInvoices.filter((x) => x.haciendaStatus === "rechazado").length;
  const miss = freshInvoices.filter((x) => x.haciendaStatus === "sin_respuesta").length;
  step("hacienda", `Hacienda aceptó ${acc}, rechazó ${rej} y falta respuesta de ${miss}.`, rej);

  const cats = new Map<string, number>();
  newExts.forEach((x) => cats.set(x.category, (cats.get(x.category) ?? 0) + 1));
  step("clasificar", [...cats].map(([c, n]) => `${c}: ${n}`).join(" · ") || "Nada nuevo para clasificar.", newExts.length);

  // 3. Reglas sobre todo el historial
  const exts = await store.listExtractions();
  const docs = joinDocs(allEmails, exts);
  const invoiceCount = docs.filter((d) => d.ext.invoice).length;
  const drafts = runRules(docs, today);
  const existing = await store.listAlerts();
  const byKey = new Map(existing.map((a) => [a.key, a]));
  const rules = await store.listRules();

  const upserts: Alert[] = [];
  const created: Alert[] = [];
  let learnedCount = 0;
  for (const d of drafts) {
    const prev = byKey.get(d.key);
    if (prev) {
      upserts.push({ ...prev, ...d, id: prev.id, status: prev.status, notified: prev.notified, learnedRuleId: prev.learnedRuleId, explanation: prev.explanation || explain(d) });
      continue;
    }
    const learned = matchLearnedRule(d, rules);
    const alert: Alert = {
      ...d,
      id: id("al", d.key),
      status: learned ? "normal_aprendido" : "abierta",
      explanation: explain(d),
      learnedRuleId: learned?.id ?? null,
      firstSeenRunId: runId,
      analyzedAt: nowIso(),
      notified: false,
    };
    if (learned) learnedCount++;
    upserts.push(alert);
    created.push(alert);
  }
  await store.upsertAlerts(upserts);
  const newOpen = created.filter((a) => a.status === "abierta");
  step("reglas", `Revisé ${plural(invoiceCount, "factura", "facturas")} contra su historial y detecté ${plural(newOpen.length, "riesgo nuevo", "riesgos nuevos")}.`, newOpen.length);
  if (learnedCount) step("aprendido", `${plural(learnedCount, "caso ignorado", "casos ignorados")} por reglas que me enseñaste.`, learnedCount);

  // 4. Acciones propuestas (nada se envía sin aprobación)
  const byEmail = new Map(docs.map((d) => [d.email.id, d]));
  for (const a of newOpen) {
    const d = byEmail.get(actionEmailId(a));
    const draft = draftAction(a, company, d?.ext, d?.email.sender);
    if (draft) await store.upsertAction({ ...draft, id: id("ac", a.id), createdAt: nowIso() });
  }

  // 5. Notificar por WhatsApp (alta y media; agrupado en un solo mensaje)
  let notified: WhatsAppMessage | null = null;
  const toNotify = newOpen
    .filter((a) => a.confidence === "alta" || a.confidence === "media") // baja nunca notifica (ADR-0003)
    .sort((a, b) => priority(b) - priority(a));
  if (toNotify.length) {
    const body = whatsappAlertText(toNotify, appUrl());
    const res = await sendCapped(store, body);
    notified = { id: id("wa", runId + body), direction: "saliente", kind: "alerta", body, status: res.status, alertId: toNotify[0].id, createdAt: nowIso() };
    await store.addMessage(notified);
    await store.upsertAlerts(toNotify.map((a) => ({ ...a, notified: true })));
    step("notificar", `Te avisé por WhatsApp de ${plural(toNotify.length, "alerta", "alertas")}${res.status === "simulado" ? " (simulado: falta configurar Twilio)" : res.status === "fallido" ? " (falló el envío)" : res.status === "tope_diario" ? " (no se envió: llegué al tope diario; está en el panel)" : ""}.`, toNotify.length);
  }

  run.headline = [
    `Leí ${plural(fresh.length, "correo", "correos")}`,
    `${plural(freshInvoices.length, "factura", "facturas")}`,
    freshInvoices.length ? `Hacienda aceptó ${acc}, rechazó ${rej} y falta ${miss}` : null,
    `revisé ${plural(invoiceCount, "factura", "facturas")} contra su historial`,
    `detecté ${plural(newOpen.length, "riesgo", "riesgos")}`,
    learnedCount ? `${plural(learnedCount, "ignorado", "ignorados")} por reglas que me enseñaste` : null,
  ].filter(Boolean).join(" · ");
  run.finishedAt = nowIso();
  await store.saveRun(run);
  return { run, newEmails: fresh.length, newAlerts: created, notified };
}

export function priority(a: AlertDraft): number {
  const base = a.type === "duplicado" && a.confidence === "alta" ? 100 : a.type === "rechazo_hacienda" ? 95 : a.type === "vencido" ? 90 : a.confidence === "alta" ? 80 : 60;
  return base + Math.min(9, Math.log10((a.amountAtRisk ?? 0) + 1));
}

// ------------------------------------------------------------------ decisiones del dueño
export async function approveAlert(store: Store, alertId: string, via: "panel" | "whatsapp"): Promise<Action> {
  const alerts = await store.listAlerts();
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert) throw new Error("No encontré esa alerta.");
  let action = (await store.listActions()).find((x) => x.alertId === alertId);
  if (!action) {
    const company = await store.getCompany();
    const docs = joinDocs(await store.listEmails(), await store.listExtractions());
    const d = docs.find((x) => x.email.id === actionEmailId(alert));
    const draft = draftAction(alert, company, d?.ext, d?.email.sender);
    if (!draft) throw new Error("Esta alerta no tiene una acción para preparar.");
    action = { ...draft, id: id("ac", alert.id), createdAt: nowIso() };
  }
  // Gmail (borradores) se conecta el domingo; mientras tanto queda aprobada y lista para copiar.
  const approved: Action = { ...action, status: "aprobada", approvedVia: via, approvedAt: nowIso() };
  await store.upsertAction(approved);
  return approved;
}

export async function markNormal(store: Store, alertId: string, via: "panel" | "whatsapp", reason = ""): Promise<LearnedRule> {
  const alerts = await store.listAlerts();
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert) throw new Error("No encontré esa alerta.");
  if (alert.type === "rechazo_hacienda") throw new Error("Un rechazo de Hacienda no se puede marcar como normal: hay que pedir la factura corregida.");
  if (alert.type === "duplicado" && alert.confidence === "alta") throw new Error("Un duplicado exacto (misma clave) no se aprende como normal. Podés descartarlo si ya lo aclaraste.");
  const rule: LearnedRule = {
    id: id("rg", alert.id + nowIso()),
    alertType: alert.type,
    counterpartyTaxId: alert.counterpartyTaxId,
    counterparty: alert.counterparty,
    condition: learnedConditionFor(alert),
    reason: reason || (alert.type === "monto_inusual" ? "Es normal en temporada." : "El dueño indicó que es normal."),
    createdFrom: via,
    sourceAlertId: alert.id,
    createdAt: nowIso(),
    active: true,
  };
  await store.upsertRule(rule);
  const affected = alerts.filter((a) => a.id === alert.id || (a.status === "abierta" && matchLearnedRule(a, [rule])));
  await store.upsertAlerts(affected.map((a) => ({ ...a, status: "normal_aprendido", learnedRuleId: rule.id })));
  for (const ac of (await store.listActions()).filter((x) => affected.some((a) => a.id === x.alertId) && x.status === "pendiente"))
    await store.upsertAction({ ...ac, status: "descartada" });
  return rule;
}

export async function dismissAlert(store: Store, alertId: string): Promise<void> {
  const alert = (await store.listAlerts()).find((a) => a.id === alertId);
  if (!alert) throw new Error("No encontré esa alerta.");
  await store.upsertAlerts([{ ...alert, status: "descartada" }]);
}

export async function deleteRule(store: Store, ruleId: string): Promise<void> {
  await store.deleteRule(ruleId);
  const alerts = (await store.listAlerts()).filter((a) => a.learnedRuleId === ruleId);
  await store.upsertAlerts(alerts.map((a) => ({ ...a, status: "abierta", learnedRuleId: null })));
}

/** "Preguntale a Pulso" (R21): mismo flujo para el panel y WhatsApp; los números salen de código. */
export async function ask(store: Store, question: string, today: string): Promise<AskAnswer> {
  const docs = joinDocs(await store.listEmails(), await store.listExtractions());
  return answerQuestion(question, docs, await store.listAlerts(), today);
}

/** Respuesta del dueño por WhatsApp: "1" aprobar, "2" es normal, "VER" detalle; cualquier otra cosa es una pregunta. */
export async function handleReply(store: Store, text: string): Promise<string> {
  const msg = text.trim().toLowerCase();
  await store.addMessage({ id: id("wa", "in" + text + nowIso()), direction: "entrante", kind: "respuesta", body: text.trim(), status: "recibido", alertId: null, createdAt: nowIso() });

  const alerts = (await store.listAlerts()).filter((a) => a.status === "abierta");
  const actions = await store.listActions();
  const lastAlertMsg = [...(await store.listMessages())].reverse().find((m) => m.direction === "saliente" && m.kind === "alerta" && m.alertId);
  const pending = (a: Alert) => !actions.some((x) => x.alertId === a.id && x.status !== "pendiente");
  const target =
    alerts.find((a) => a.id === lastAlertMsg?.alertId && pending(a)) ??
    alerts.filter((a) => a.notified && pending(a)).sort((a, b) => priority(b) - priority(a))[0];

  let reply: string;
  try {
    if (msg === "1" || msg.startsWith("aprob")) {
      if (!target) reply = "No tengo alertas pendientes. ✅";
      else {
        const action = await approveAlert(store, target.id, "whatsapp");
        reply = `✅ Listo. Preparé el correo para ${target.counterparty}: "${action.subject}". Revisalo y envialo desde tu correo. No envié nada.`;
      }
    } else if (msg === "2" || msg.includes("normal")) {
      if (!target) reply = "No tengo alertas pendientes. ✅";
      else {
        await markNormal(store, target.id, "whatsapp");
        reply = `👍 Entendido: lo de ${target.counterparty} es normal. La próxima vez no te molesto con eso (lo vas a ver en gris en el panel).`;
      }
    } else if (msg === "ver" || msg.startsWith("ver ")) {
      reply = target ? `🔎 ${alertTitle(target)} · ${target.counterparty}: ${appUrl()}/?alerta=${target.id}` : `🔎 Tu panel: ${appUrl()}`;
    } else {
      const a = await ask(store, text, todayCR());
      reply = a.intent === "no_entendi"
        ? `${a.answer}\n\nO respondé *1* para preparar el correo, *2* si es normal, o *VER* para el detalle.`
        : `${a.answer}${a.sources.length ? `\n\n📎 ${plural(a.sources.length, "correo de respaldo", "correos de respaldo")} en el panel: ${appUrl()}` : ""}`;
    }
  } catch (err) {
    reply = `⚠️ ${err instanceof Error ? err.message : "No pude hacerlo."}`;
  }
  const res = await sendWhatsApp(reply);
  await store.addMessage({ id: id("wa", "out" + reply + nowIso()), direction: "saliente", kind: "respuesta", body: reply, status: res.status, alertId: target?.id ?? null, createdAt: nowIso() });
  return reply;
}

export async function sendWeekDigest(store: Store, items: { title: string; why: string; amount: number | null }[]): Promise<WhatsAppMessage> {
  const lines = items.slice(0, 6).map((it, i) => `${i + 1}. ${it.title}${it.amount ? ` (${colones(it.amount)})` : ""}`);
  const body = `*Pulso · Tu semana* 🗓️\n\n${lines.join("\n") || "No hay nada urgente. ✅"}\n\nDetalle: ${appUrl()}`;
  const res = await sendCapped(store, body);
  const m: WhatsAppMessage = { id: id("wa", "digest" + nowIso()), direction: "saliente", kind: "resumen", body, status: res.status, alertId: null, createdAt: nowIso() };
  await store.addMessage(m);
  return m;
}
