// Reglas de alertas (ADR-0003): funciones puras, explícitas y con nivel de confianza.
// Entrada: documentos ya extraídos. Salida: borradores de alerta. La IA no decide si hay alerta.
import type { AlertDraft, EmailRecord, Extraction, LearnedRule } from "../types";
import { colones, daysBetween, fecha } from "../format";

export interface Doc {
  email: EmailRecord;
  ext: Extraction;
}

export const THRESHOLDS = {
  probableDuplicateDays: 15,
  unusualHighRatio: 2.0,
  unusualHighMinPrev: 3,
  unusualMediumRatio: 1.5,
  unusualMediumMinPrev: 2,
  upcomingDays: 7,
  /** Diferencia que se tolera entre el datáfono y el cierre de caja (redondeos, propinas). */
  settlementMinDiff: 1000,
  settlementMinPct: 0.005,
};

const invoices = (docs: Doc[]) =>
  docs
    .filter((d) => d.ext.invoice && d.ext.category === "proveedores")
    .sort((a, b) => a.ext.invoice!.issuedAt.localeCompare(b.ext.invoice!.issuedAt) || a.email.receivedAt.localeCompare(b.email.receivedAt));

// ---------------------------------------------------------------- posibles duplicados
export function ruleDuplicates(docs: Doc[]): AlertDraft[] {
  const out: AlertDraft[] = [];
  const inv = invoices(docs);

  // Exacto: misma clave numérica (o mismo emisor + consecutivo) en más de un correo.
  const byKey = new Map<string, Doc[]>();
  for (const d of inv) {
    const k = d.ext.invoice!.numericKey || `${d.ext.invoice!.issuerTaxId}:${d.ext.invoice!.docNumber}`;
    byKey.set(k, [...(byKey.get(k) ?? []), d]);
  }
  const exactEmailIds = new Set<string>();
  for (const [k, group] of byKey) {
    if (group.length < 2) continue;
    const i = group[0].ext.invoice!;
    group.forEach((g) => exactEmailIds.add(g.email.id));
    out.push({
      key: `duplicado:exacto:${k}`,
      type: "duplicado",
      confidence: "alta",
      reason: `Mismo emisor y mismo número consecutivo (${i.docNumber}), con la misma clave numérica.`,
      ruleApplied: "duplicado.exacto.misma_clave",
      emailIds: group.map((g) => g.email.id),
      amountAtRisk: i.total * (group.length - 1),
      counterparty: i.issuerName,
      counterpartyTaxId: i.issuerTaxId,
      meta: { docNumber: i.docNumber, numericKey: i.numericKey, copies: group.length },
    });
  }

  // Probable: mismo emisor + mismo monto, ≤ N días, consecutivo distinto.
  for (let a = 0; a < inv.length; a++) {
    for (let b = a + 1; b < inv.length; b++) {
      const A = inv[a].ext.invoice!, B = inv[b].ext.invoice!;
      if (A.issuerTaxId !== B.issuerTaxId || A.docNumber === B.docNumber) continue;
      if (Math.abs(A.total - B.total) > 0.01) continue;
      const days = Math.abs(daysBetween(A.issuedAt.slice(0, 10), B.issuedAt.slice(0, 10)));
      if (days > THRESHOLDS.probableDuplicateDays) continue;
      if (exactEmailIds.has(inv[a].email.id) && exactEmailIds.has(inv[b].email.id)) continue;
      out.push({
        key: `duplicado:probable:${A.issuerTaxId}:${A.docNumber}:${B.docNumber}`,
        type: "duplicado",
        confidence: "media",
        reason: `Mismo emisor y mismo monto (${colones(A.total)}) con ${days} días de diferencia, pero distinto número consecutivo.`,
        ruleApplied: "duplicado.probable.mismo_monto",
        emailIds: [inv[b].email.id, inv[a].email.id],
        amountAtRisk: B.total,
        counterparty: A.issuerName,
        counterpartyTaxId: A.issuerTaxId,
        meta: { days, amount: A.total, docNumbers: [A.docNumber, B.docNumber] },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- montos inusuales
export function ruleUnusualAmounts(docs: Doc[]): AlertDraft[] {
  const out: AlertDraft[] = [];
  const inv = invoices(docs);
  const seen = new Set<string>(); // no contar dos veces el mismo documento reenviado
  const history = new Map<string, Doc[]>();
  for (const d of inv) {
    const i = d.ext.invoice!;
    const docKey = `${i.issuerTaxId}:${i.docNumber}`;
    if (seen.has(docKey)) continue;
    seen.add(docKey);
    const prev = history.get(i.issuerTaxId) ?? [];
    if (prev.length >= THRESHOLDS.unusualMediumMinPrev) {
      const avg = prev.reduce((s, p) => s + p.ext.invoice!.total, 0) / prev.length;
      const ratio = i.total / avg;
      const high = ratio > THRESHOLDS.unusualHighRatio && prev.length >= THRESHOLDS.unusualHighMinPrev;
      const medium = ratio > THRESHOLDS.unusualMediumRatio;
      if (high || medium) {
        out.push({
          key: `monto_inusual:${i.issuerTaxId}:${i.docNumber}`,
          type: "monto_inusual",
          confidence: high ? "alta" : "media",
          reason: `Monto ${ratio.toFixed(1)} veces el promedio (${colones(Math.round(avg))}) de las ${prev.length} facturas anteriores de este proveedor.`,
          ruleApplied: high ? "monto_inusual.mayor_2x" : "monto_inusual.mayor_1_5x",
          emailIds: [d.email.id, ...prev.map((p) => p.email.id)],
          amountAtRisk: Math.round((i.total - avg) * 100) / 100,
          counterparty: i.issuerName,
          counterpartyTaxId: i.issuerTaxId,
          meta: {
            ratio: Math.round(ratio * 100) / 100,
            average: Math.round(avg * 100) / 100,
            history: prev.map((p) => ({ emailId: p.email.id, date: p.ext.invoice!.issuedAt.slice(0, 10), total: p.ext.invoice!.total, docNumber: p.ext.invoice!.docNumber })),
          },
        });
      }
    }
    history.set(i.issuerTaxId, [...prev, d]);
  }
  return out;
}

// ---------------------------------------------------------------- cobro sin factura
const simplify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(s\.?a\.?|srl|ltda|cr|de|del|la|el|y)\b/g, "").replace(/[^a-z0-9]/g, "");

export function ruleChargeWithoutInvoice(docs: Doc[]): AlertDraft[] {
  const issuers = invoices(docs).map((d) => ({ name: simplify(d.ext.invoice!.issuerName), taxId: d.ext.invoice!.issuerTaxId }));
  return docs
    .filter((d) => d.ext.category === "proveedores" && d.ext.kind === "cobro" && !d.ext.invoice && d.ext.amount)
    .filter((d) => {
      if (d.ext.counterpartyTaxId && issuers.some((i) => i.taxId === d.ext.counterpartyTaxId)) return false;
      const n = simplify(d.ext.counterparty ?? "");
      return !issuers.some((i) => n && (i.name.includes(n) || n.includes(i.name)));
    })
    .map((d) => ({
      key: `cobro_sin_factura:${d.email.id}`,
      type: "cobro_sin_factura" as const,
      confidence: "alta" as const,
      reason: `Piden un pago de ${colones(d.ext.amount)} y no hay ninguna factura electrónica de ${d.ext.counterparty ?? "ese emisor"}.`,
      ruleApplied: "cobro_sin_factura.sin_xml_del_emisor",
      emailIds: [d.email.id],
      amountAtRisk: d.ext.amount,
      counterparty: d.ext.counterparty,
      counterpartyTaxId: d.ext.counterpartyTaxId,
      meta: {},
    }));
}

// ---------------------------------------------------------------- rechazo de Hacienda
export function ruleHaciendaRejected(docs: Doc[]): AlertDraft[] {
  return docs
    .filter((d) => d.ext.invoice && d.ext.haciendaStatus === "rechazado")
    .map((d) => {
      const i = d.ext.invoice!;
      return {
        key: `rechazo_hacienda:${i.numericKey}`,
        type: "rechazo_hacienda" as const,
        confidence: "alta" as const,
        reason: `Hacienda rechazó la factura ${i.docNumber}: ${(d.ext.haciendaDetail ?? "sin detalle").replace(/\.$/, "")}. Así no sirve como gasto.`,
        ruleApplied: "rechazo_hacienda.mensaje_3",
        emailIds: [d.email.id],
        amountAtRisk: i.total,
        counterparty: i.issuerName,
        counterpartyTaxId: i.issuerTaxId,
        meta: { detail: d.ext.haciendaDetail, docNumber: i.docNumber },
      };
    });
}

// ---------------------------------------------------------------- vencidos
export function ruleOverdue(docs: Doc[], today: string): AlertDraft[] {
  const seen = new Set<string>();
  return docs
    .filter((d) => d.ext.status === "vencido" || (d.ext.status === "pendiente" && d.ext.dueDate && d.ext.dueDate < today && ["cobro", "cobro_pendiente", "factura"].includes(d.ext.kind)))
    .filter((d) => {
      const k = d.ext.invoice ? `${d.ext.invoice.issuerTaxId}:${d.ext.invoice.docNumber}` : d.email.id;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((d) => {
      const porCobrar = d.ext.kind === "cobro_pendiente";
      const days = d.ext.dueDate ? daysBetween(d.ext.dueDate, today) : null;
      return {
        key: `vencido:${d.email.id}`,
        type: "vencido" as const,
        confidence: d.ext.dueDate || d.ext.status === "vencido" ? ("alta" as const) : ("baja" as const),
        reason: porCobrar
          ? `${d.ext.counterparty} te debe ${colones(d.ext.amount)} desde el ${fecha(d.ext.dueDate)}${days ? ` (${days} días)` : ""}.`
          : `${d.ext.counterparty}: ${colones(d.ext.amount)} vencido${d.ext.dueDate ? ` el ${fecha(d.ext.dueDate)}` : ""}.`,
        ruleApplied: porCobrar ? "vencido.por_cobrar" : "vencido.por_pagar",
        emailIds: [d.email.id],
        amountAtRisk: d.ext.amount,
        counterparty: d.ext.counterparty,
        counterpartyTaxId: d.ext.counterpartyTaxId,
        meta: { porCobrar, dueDate: d.ext.dueDate, days },
      };
    });
}

// ---------------------------------------------------------------- cierre que no cuadra
/**
 * Las ventas con tarjeta del cierre de caja (software de facturación) tienen que coincidir
 * con lo que cobró el datáfono ese mismo día. Alta: los dos leídos del CSV. Media: alguno
 * leído del texto del correo. Dentro de la tolerancia, cuadra y no hay alerta.
 */
export function ruleSettlementMismatch(docs: Doc[]): AlertDraft[] {
  const byDate = new Map<string, { pos?: Doc; sales?: Doc }>();
  for (const d of [...docs].sort((a, b) => a.email.receivedAt.localeCompare(b.email.receivedAt))) {
    const st = d.ext.settlement;
    if (!st) continue;
    const day = byDate.get(st.date) ?? {};
    if (st.source === "datafono") day.pos ??= d;
    else day.sales ??= d;
    byDate.set(st.date, day);
  }
  const out: AlertDraft[] = [];
  for (const [date, { pos, sales }] of byDate) {
    if (!pos || !sales) continue;
    const posCard = pos.ext.settlement!.card;
    const salesCard = sales.ext.settlement!.card;
    const diff = salesCard - posCard; // > 0: el datáfono cobró menos de lo facturado con tarjeta
    const tolerance = Math.max(THRESHOLDS.settlementMinDiff, THRESHOLDS.settlementMinPct * Math.max(posCard, salesCard));
    if (Math.abs(diff) <= tolerance) continue;
    const exact = pos.ext.settlement!.fromFile && sales.ext.settlement!.fromFile;
    const missing = diff > 0;
    out.push({
      key: `cierre_descuadre:${date}`,
      type: "cierre_descuadre",
      confidence: exact ? "alta" : "media",
      reason: missing
        ? `El cierre de caja registra ${colones(salesCard)} en ventas con tarjeta el ${fecha(date)}, pero el datáfono cobró ${colones(posCard)}: faltan ${colones(diff)}.`
        : `El datáfono cobró ${colones(posCard)} el ${fecha(date)}, pero el cierre de caja registra ${colones(salesCard)} en ventas con tarjeta: hay ${colones(-diff)} cobrados con tarjeta sin factura registrada.`,
      ruleApplied: exact ? "cierre_descuadre.csv" : "cierre_descuadre.texto",
      emailIds: [sales.email.id, pos.email.id],
      amountAtRisk: Math.abs(diff),
      counterparty: pos.ext.counterparty,
      counterpartyTaxId: null,
      meta: {
        date, posCard, salesCard, diff, direction: missing ? "faltante" : "sobrante",
        commission: pos.ext.settlement!.commission, deposit: pos.ext.settlement!.deposit,
        batch: pos.ext.settlement!.batch, salesSoftware: sales.ext.counterparty,
      },
    });
  }
  return out;
}

/** Documentos que no son alerta pero hay que revisar (confianza baja). */
export function toReview(docs: Doc[]): { emailId: string; reason: string }[] {
  const out: { emailId: string; reason: string }[] = [];
  for (const d of docs) {
    if (d.ext.invoice && d.ext.haciendaStatus === "sin_respuesta")
      out.push({ emailId: d.email.id, reason: `Factura ${d.ext.invoice.docNumber} de ${d.ext.counterparty} sin respuesta de Hacienda: falta la confirmación.` });
    else if (d.ext.doubtfulFields.length)
      out.push({ emailId: d.email.id, reason: `Datos dudosos (${d.ext.doubtfulFields.join(", ")}): confirmalos.` });
  }
  return out;
}

export function runRules(docs: Doc[], today: string): AlertDraft[] {
  return [
    ...ruleDuplicates(docs),
    ...ruleHaciendaRejected(docs),
    ...ruleUnusualAmounts(docs),
    ...ruleChargeWithoutInvoice(docs),
    ...ruleOverdue(docs, today),
    ...ruleSettlementMismatch(docs),
  ].filter((a) => a.confidence !== "baja");
}

// ---------------------------------------------------------------- reglas aprendidas (ADR-0007)
export function matchLearnedRule(alert: AlertDraft, rules: LearnedRule[]): LearnedRule | null {
  if (alert.type === "rechazo_hacienda") return null; // nunca se silencia
  for (const r of rules) {
    if (!r.active || r.alertType !== alert.type) continue;
    if (r.counterpartyTaxId && alert.counterpartyTaxId && r.counterpartyTaxId !== alert.counterpartyTaxId) continue;
    if (!r.counterpartyTaxId && r.counterparty && r.counterparty !== alert.counterparty) continue;
    if (alert.type === "monto_inusual") {
      const ratio = Number(alert.meta.ratio ?? 0);
      if (r.condition.maxRatio !== undefined && ratio <= r.condition.maxRatio) return r;
      continue;
    }
    if (alert.type === "duplicado") {
      if (alert.confidence === "alta") continue; // un duplicado exacto no se aprende como normal
      if (r.condition.amount !== undefined && Math.abs(Number(alert.meta.amount) - r.condition.amount) < 0.01) return r;
      continue;
    }
    if (alert.type === "cierre_descuadre") {
      if (r.condition.maxDiff !== undefined && (alert.amountAtRisk ?? Infinity) <= r.condition.maxDiff) return r;
      continue;
    }
    if (alert.type === "vencido" || alert.type === "cobro_sin_factura") {
      if (!r.condition.emailId || alert.emailIds.includes(r.condition.emailId)) return r;
    }
  }
  return null;
}

/** Condición de la regla que se aprende cuando el dueño dice "esto es normal". */
export function learnedConditionFor(alert: AlertDraft): LearnedRule["condition"] {
  if (alert.type === "monto_inusual") {
    const ratio = Number(alert.meta.ratio ?? 1.5);
    return { maxRatio: Math.round(Math.max(ratio * 1.2, THRESHOLDS.unusualHighRatio) * 100) / 100 };
  }
  if (alert.type === "duplicado") return { amount: Number(alert.meta.amount ?? alert.amountAtRisk ?? 0) };
  // "Es normal" en un descuadre: diferencias de hasta este monto con ese datáfono (p. ej. propinas).
  if (alert.type === "cierre_descuadre") return { maxDiff: Math.round((alert.amountAtRisk ?? 0) * 1.2) };
  return { emailId: alert.emailIds[0] };
}
