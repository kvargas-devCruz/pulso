// Estado completo para el panel: todo sale de la misma fuente (el store).
import type { Store } from "./store";
import type { Category } from "./types";
import { joinDocs, priority } from "./engine/pipeline";
import { toReview } from "./engine/rules";
import { semaphore, upcoming, yourWeek, categoryLabel, companyCharts } from "./engine/status";
import { alertTitle } from "./engine/explain";
import { senderName } from "./engine/extract";
import { claudeEnabled } from "./engine/claude";
import { SUGGESTED_QUESTIONS } from "./engine/ask";
import { whatsappConfigured } from "./notify/whatsapp";

export async function buildState(store: Store, today: string) {
  const [company, emails, exts, alerts, rules, actions, messages, runs] = await Promise.all([
    store.getCompany(), store.listEmails(), store.listExtractions(), store.listAlerts(),
    store.listRules(), store.listActions(), store.listMessages(), store.listRuns(),
  ]);
  const docs = joinDocs(emails, exts);
  const next = upcoming(docs, today);
  const sem = semaphore(alerts, next);
  const lastRun = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;

  const categories = (["proveedores", "hacienda", "ccss", "ins", "bancos", "clientes", "contador", "ventas", "ruido"] as Category[]).map((c) => {
    const items = docs.filter((d) => d.ext.category === c);
    const pend = items.filter((d) => d.ext.status === "pendiente" || d.ext.status === "vencido");
    const unique = new Map(pend.map((d) => [d.ext.invoice ? `${d.ext.invoice.issuerTaxId}:${d.ext.invoice.docNumber}` : d.email.id, d]));
    return {
      category: c,
      label: categoryLabel(c),
      count: items.length,
      pendingCount: unique.size,
      pendingTotal: [...unique.values()].reduce((s, d) => s + (d.ext.amount ?? 0), 0),
    };
  });

  const receivables = docs
    .filter((d) => d.ext.kind === "cobro_pendiente" && d.ext.status !== "pagado")
    .map((d) => ({ emailId: d.email.id, counterparty: d.ext.counterparty, amount: d.ext.amount, dueDate: d.ext.dueDate, status: d.ext.status }));

  // Todos los correos (también el ruido) para las pestañas por categoría; la tabla general filtra el ruido.
  const openByEmail = new Map<string, number>();
  // Solo el documento principal de cada alerta (en un duplicado, los dos); el resto de emailIds es historial de evidencia.
  for (const a of alerts.filter((x) => x.status === "abierta"))
    for (const id of a.type === "duplicado" ? a.emailIds.slice(0, 2) : a.emailIds.slice(0, 1)) openByEmail.set(id, (openByEmail.get(id) ?? 0) + 1);
  const documents = docs
    .map((d) => ({
      emailId: d.email.id,
      receivedAt: d.email.receivedAt,
      from: senderName(d.email.sender),
      subject: d.email.subject,
      category: d.ext.category,
      kind: d.ext.kind,
      counterparty: d.ext.counterparty,
      amount: d.ext.amount,
      dueDate: d.ext.dueDate,
      status: d.ext.status,
      haciendaStatus: d.ext.haciendaStatus,
      docNumber: d.ext.invoice?.docNumber ?? null,
      amountSource: d.ext.amountSource,
      extractedBy: d.ext.extractedBy,
      summary: d.ext.summary,
      openAlerts: openByEmail.get(d.email.id) ?? 0,
    }))
    .reverse();

  return {
    today,
    company,
    mode: {
      store: store.kind,
      claude: claudeEnabled(),
      whatsapp: whatsappConfigured(),
      gmail: false,
    },
    lastRun,
    semaphore: sem,
    alerts: alerts
      .map((a) => ({ ...a, title: alertTitle(a), action: actions.find((x) => x.alertId === a.id) ?? null }))
      .sort((a, b) => (a.status === b.status ? priority(b) - priority(a) : a.status === "abierta" ? -1 : 1)),
    review: toReview(docs),
    upcoming: next,
    receivables,
    week: yourWeek(alerts, next),
    categories,
    charts: companyCharts(docs, today),
    suggestions: SUGGESTED_QUESTIONS,
    documents,
    rules,
    messages,
    counts: { emails: emails.length, documents: docs.length, invoices: docs.filter((d) => d.ext.invoice).length },
    loaded: { lote1: emails.some((e) => e.externalId.startsWith("lote-1")), lote2: emails.some((e) => e.externalId.startsWith("lote-2")) },
  };
}

export type PulsoState = Awaited<ReturnType<typeof buildState>>;
