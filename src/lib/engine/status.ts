// Estado de la empresa: semáforo, próximos vencimientos, por cobrar y "Tu semana".
// Todo calculado con código a partir de alertas y documentos.
import type { Alert, Category } from "../types";
import type { Doc } from "./rules";
import { THRESHOLDS } from "./rules";
import { colones, daysBetween, fecha, plural } from "../format";

export type Light = "verde" | "amarillo" | "rojo";

export interface Upcoming {
  emailId: string;
  counterparty: string | null;
  amount: number | null;
  dueDate: string;
  days: number;
  label: string;
  porCobrar: boolean;
}

export interface Semaphore {
  light: Light;
  phrase: string;
  overdueCount: number;
  riskCount: number;
  upcomingCount: number;
  moneyAtRisk: number;
}

export interface WeekItem {
  priority: number;
  title: string;
  why: string;
  amount: number | null;
  emailId: string | null;
  alertId: string | null;
}

const LABEL: Record<Category, string> = {
  hacienda: "Hacienda", ccss: "CCSS", ins: "INS", bancos: "Bancos", proveedores: "Proveedores",
  clientes: "Clientes", contador: "Contador", ruido: "Ruido",
};
export const categoryLabel = (c: Category) => LABEL[c];

export function upcoming(docs: Doc[], today: string): Upcoming[] {
  const seen = new Set<string>();
  return docs
    .filter((d) => d.ext.dueDate && d.ext.status === "pendiente")
    .map((d) => ({ d, days: daysBetween(today, d.ext.dueDate!) }))
    .filter(({ days }) => days >= 0 && days <= THRESHOLDS.upcomingDays)
    .filter(({ d }) => {
      const k = d.ext.invoice ? `${d.ext.invoice.issuerTaxId}:${d.ext.invoice.docNumber}` : d.email.id;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map(({ d, days }) => ({
      emailId: d.email.id,
      counterparty: d.ext.counterparty,
      amount: d.ext.amount,
      dueDate: d.ext.dueDate!,
      days,
      porCobrar: d.ext.kind === "cobro_pendiente",
      label:
        d.ext.kind === "solicitud"
          ? `${d.ext.counterparty}: ${d.ext.requestedDocuments.length ? plural(d.ext.requestedDocuments.length, "documento pedido", "documentos pedidos") : "solicitud pendiente"}`
          : `${d.ext.counterparty}: ${colones(d.ext.amount)}`,
    }))
    .sort((a, b) => a.days - b.days);
}

export function semaphore(alerts: Alert[], next: Upcoming[]): Semaphore {
  const open = alerts.filter((a) => a.status === "abierta");
  const overdue = open.filter((a) => a.type === "vencido");
  const risks = open.filter((a) => a.type !== "vencido");
  const high = open.filter((a) => a.confidence === "alta");
  const money = open
    .filter((a) => !(a.type === "vencido" && a.meta.porCobrar))
    .reduce((s, a) => s + (a.amountAtRisk ?? 0), 0);

  const light: Light = overdue.length || high.length ? "rojo" : open.length || next.length ? "amarillo" : "verde";
  const parts: string[] = [];
  if (overdue.length) parts.push(plural(overdue.length, "asunto vencido", "asuntos vencidos"));
  if (risks.length) parts.push(plural(risks.length, "cosa que no cuadra", "cosas que no cuadran"));
  if (next.length) parts.push(`${plural(next.length, "vencimiento", "vencimientos")} en los próximos 7 días`);
  const phrase =
    light === "verde" ? "Estás al día. No hay nada vencido ni nada raro en tu correo."
    : `Tenés ${parts.length > 1 ? parts.slice(0, -1).join(", ") + " y " + parts.at(-1) : parts[0]}.`;

  return { light, phrase, overdueCount: overdue.length, riskCount: risks.length, upcomingCount: next.length, moneyAtRisk: Math.round(money * 100) / 100 };
}

/** Plan priorizado por urgencia, gravedad y monto, con la razón. */
export function yourWeek(alerts: Alert[], next: Upcoming[]): WeekItem[] {
  const items: WeekItem[] = [];
  for (const a of alerts.filter((x) => x.status === "abierta")) {
    const base = a.type === "vencido" ? 100 : a.type === "rechazo_hacienda" || (a.type === "duplicado" && a.confidence === "alta") ? 90 : a.confidence === "alta" ? 80 : 60;
    const title =
      a.type === "vencido" ? (a.meta.porCobrar ? `Cobrarle a ${a.counterparty}` : `Pagar a ${a.counterparty}`)
      : a.type === "duplicado" ? `Aclarar posible factura duplicada de ${a.counterparty}`
      : a.type === "monto_inusual" ? `Revisar el cobro de ${a.counterparty}`
      : a.type === "rechazo_hacienda" ? `Pedir a ${a.counterparty} que corrija la factura rechazada`
      : `Verificar el cobro de ${a.counterparty} (no hay factura)`;
    items.push({ priority: base + Math.min(9, Math.log10((a.amountAtRisk ?? 1) + 1)), title, why: a.reason, amount: a.amountAtRisk, emailId: a.emailIds[0], alertId: a.id });
  }
  for (const u of next) {
    items.push({
      priority: 70 - u.days,
      title: u.porCobrar ? `Cobrar a ${u.counterparty}` : u.label,
      why: u.days === 0 ? "Vence hoy." : `Vence el ${fecha(u.dueDate)} (en ${plural(u.days, "día", "días")}).`,
      amount: u.amount,
      emailId: u.emailId,
      alertId: null,
    });
  }
  return items.sort((a, b) => b.priority - a.priority);
}
