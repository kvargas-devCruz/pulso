// "Preguntale a Pulso" (R21): respuestas en lenguaje natural que citan la fuente.
// La pregunta solo elige QUÉ calcular; los montos y las fechas salen de código
// (ADR-0002), igual que en el resto del panel. Función pura: pregunta + datos → respuesta.
import type { Alert } from "../types";
import type { Doc } from "./rules";
import { alertTitle } from "./explain";
import { payState, payableDocs, upcoming } from "./status";
import { colones, daysBetween, fecha, plural } from "../format";

export interface AskSource { emailId: string; label: string; counterparty: string | null }
export interface AskAnswer {
  intent: "cuadre" | "hacienda" | "ventas" | "me_deben" | "proveedor" | "debo" | "riesgos" | "no_entendi";
  answer: string;
  sources: AskSource[];
}

export const SUGGESTED_QUESTIONS = [
  "¿Cuánto debo esta semana?",
  "¿Quién me debe?",
  "¿Cuadró el datáfono ayer?",
  "¿Cuánto vendí esta semana?",
  "¿Hay facturas rechazadas por Hacienda?",
  "¿Qué no cuadra?",
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿?¡!.,]/g, " ").replace(/\s+/g, " ").trim();
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const src = (d: Doc, label?: string): AskSource => ({ emailId: d.email.id, label: label ?? `${d.ext.counterparty ?? "Correo"} · ${fecha(d.email.receivedAt)}`, counterparty: d.ext.counterparty });

/** "hoy", "ayer", "anteayer" o "17/11" → fecha ISO; null si la pregunta no trae fecha. */
function dateIn(q: string, today: string): string | null {
  if (/\banteayer\b|\bantier\b/.test(q)) return addDays(today, -2);
  if (/\bayer\b/.test(q)) return addDays(today, -1);
  if (/\bhoy\b/.test(q)) return today;
  const m = q.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (m) return `${m[3] ?? today.slice(0, 4)}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const STOP = new Set(["sa", "s", "a", "de", "del", "la", "el", "y", "cr", "srl", "ltda", "servicios", "costa", "rica"]);
/** Contraparte mencionada en la pregunta (por una palabra distintiva de su nombre). */
function counterpartyIn(q: string, docs: Doc[]): string | null {
  const names = [...new Set(docs.map((d) => d.ext.counterparty).filter((n): n is string => !!n))];
  let best: { name: string; len: number } | null = null;
  for (const name of names) {
    for (const w of norm(name).split(" ").filter((w) => w.length >= 4 && !STOP.has(w))) {
      if (new RegExp(`\\b${w}\\b`).test(q) && (!best || w.length > best.len)) best = { name, len: w.length };
    }
  }
  return best?.name ?? null;
}

export function answerQuestion(question: string, docs: Doc[], alerts: Alert[], today: string): AskAnswer {
  const q = norm(question);
  const open = alerts.filter((a) => a.status === "abierta");
  const byId = new Map(docs.map((d) => [d.email.id, d]));

  // ------------------------------------------------ ¿cuadró el datáfono?
  if (/datafono|cierre|\bcaja\b|cuadro\b/.test(q)) {
    const closures = docs.filter((d) => d.ext.settlement);
    if (!closures.length) return { intent: "cuadre", answer: "Todavía no me llegó ningún cierre del datáfono ni de caja.", sources: [] };
    const dates = [...new Set(closures.map((d) => d.ext.settlement!.date))].sort();
    const asked = dateIn(q, today);
    const date = asked ?? [...dates].reverse().find((dt) => closures.filter((d) => d.ext.settlement!.date === dt).length >= 2) ?? dates[dates.length - 1];
    const pos = closures.find((d) => d.ext.settlement!.date === date && d.ext.settlement!.source === "datafono");
    const sales = closures.find((d) => d.ext.settlement!.date === date && d.ext.settlement!.source === "facturacion");
    const sources = [pos, sales].filter((d): d is Doc => !!d).map((d) => src(d, `${d.ext.settlement!.source === "datafono" ? "Cierre del datáfono" : "Cierre de caja"} del ${fecha(date)}`));
    if (!pos && !sales) return { intent: "cuadre", answer: `No tengo cierres del ${fecha(date)}. El último que tengo es del ${fecha(dates[dates.length - 1])}.`, sources: [] };
    if (!pos || !sales) return { intent: "cuadre", answer: `Del ${fecha(date)} solo tengo el ${pos ? "cierre del datáfono" : "cierre de caja"}; falta el ${pos ? "cierre de caja" : "del datáfono"} para cuadrarlos.`, sources };
    const alert = open.find((a) => a.type === "cierre_descuadre" && a.meta.date === date) ?? alerts.find((a) => a.type === "cierre_descuadre" && a.meta.date === date);
    if (alert) return { intent: "cuadre", answer: `No cuadró. ${alert.reason}`, sources };
    return { intent: "cuadre", answer: `Sí, el ${fecha(date)} cuadró: el datáfono cobró ${colones(pos.ext.settlement!.card)} y el cierre de caja registra ${colones(sales.ext.settlement!.card)} con tarjeta.`, sources };
  }

  // ------------------------------------------------ Hacienda
  if (/hacienda|rechaz/.test(q)) {
    const inv = docs.filter((d) => d.ext.invoice);
    const rejected = inv.filter((d) => d.ext.haciendaStatus === "rechazado");
    const missing = inv.filter((d) => d.ext.haciendaStatus === "sin_respuesta");
    const parts: string[] = [];
    parts.push(rejected.length
      ? `Sí: Hacienda rechazó ${plural(rejected.length, "factura", "facturas")} (${rejected.map((d) => `${d.ext.counterparty}, ${colones(d.ext.amount)}`).join("; ")}). ${rejected.length === 1 ? "Así no te sirve como gasto hasta que la corrijan." : "Así no te sirven como gasto hasta que las corrijan."}`
      : "No: Hacienda no ha rechazado ninguna de tus facturas.");
    if (missing.length) parts.push(`A ${plural(missing.length, "factura", "facturas")} todavía ${missing.length === 1 ? "le" : "les"} falta la respuesta de Hacienda (${missing.map((d) => d.ext.counterparty).join(", ")}).`);
    parts.push(`Aceptadas: ${inv.filter((d) => d.ext.haciendaStatus === "aceptado").length} de ${inv.length}.`);
    return { intent: "hacienda", answer: parts.join(" "), sources: [...rejected, ...missing].map((d) => src(d, `Factura de ${d.ext.counterparty}`)) };
  }

  // ------------------------------------------------ ventas
  if (/\bvend|\bventa/.test(q)) {
    const sales = docs.filter((d) => d.ext.settlement?.source === "facturacion");
    if (!sales.length) return { intent: "ventas", answer: "Todavía no me llegó ningún cierre de caja de tu sistema de facturación, así que no sé cuánto vendiste.", sources: [] };
    const asked = dateIn(q, today);
    const from = asked ?? addDays(today, /\bmes\b/.test(q) ? -29 : -6);
    const to = asked ?? today;
    const inRange = sales.filter((d) => d.ext.settlement!.date >= from && d.ext.settlement!.date <= to);
    const period = asked ? `el ${fecha(asked)}` : /\bmes\b/.test(q) ? "en los últimos 30 días" : "en los últimos 7 días";
    if (!inRange.length) return { intent: "ventas", answer: `No tengo cierres de caja ${period}.`, sources: [] };
    const sum = (f: (s: NonNullable<Doc["ext"]["settlement"]>) => number | null) => inRange.reduce((t, d) => t + (f(d.ext.settlement!) ?? 0), 0);
    return {
      intent: "ventas",
      answer: `Vendiste ${colones(sum((s) => s.total))} ${period} (${plural(inRange.length, "cierre de caja", "cierres de caja")}): efectivo ${colones(sum((s) => s.cash))}, tarjeta ${colones(sum((s) => s.card))} y SINPE ${colones(sum((s) => s.sinpe))}.`,
      sources: inRange.map((d) => src(d, `Cierre de caja del ${fecha(d.ext.settlement!.date)}`)),
    };
  }

  // ------------------------------------------------ me deben
  if (/me deben|me debe|\bdeben\b|por cobrar|cobrarle|quien me/.test(q)) {
    const recv = docs.filter((d) => d.ext.kind === "cobro_pendiente" && d.ext.status !== "pagado");
    if (!recv.length) return { intent: "me_deben", answer: "Según tu correo, nadie te debe plata ahora. ✅", sources: [] };
    const total = recv.reduce((t, d) => t + (d.ext.amount ?? 0), 0);
    const lines = recv.map((d) => `${d.ext.counterparty}: ${colones(d.ext.amount)}${d.ext.dueDate && d.ext.dueDate < today ? ` (vencido desde el ${fecha(d.ext.dueDate)})` : ""}`);
    return { intent: "me_deben", answer: `Te deben ${colones(total)}. ${lines.join("; ")}.`, sources: recv.map((d) => src(d)) };
  }

  // ------------------------------------------------ cuánto le debo a <proveedor>
  const who = counterpartyIn(q, docs);
  if (who && /debo|deuda|pagar|pendiente|cobr|factur/.test(q)) {
    const mine = payableDocs(docs).filter((d) => d.ext.counterparty === who);
    const pend = mine.filter((d) => payState(d, today) !== "pagado");
    const openFor = open.filter((a) => a.counterparty === who);
    if (!pend.length) return { intent: "proveedor", answer: `No le debés nada a ${who}${mine.length ? `: las ${mine.length} cuentas que tengo están pagadas` : ""}.${openFor.length ? ` Ojo: hay ${plural(openFor.length, "alerta abierta", "alertas abiertas")} (${openFor.map(alertTitle).join(", ").toLowerCase()}).` : ""}`, sources: mine.map((d) => src(d)) };
    const total = pend.reduce((t, d) => t + d.ext.amount!, 0);
    const lines = pend.map((d) => `${colones(d.ext.amount)}${d.ext.dueDate ? ` (vence el ${fecha(d.ext.dueDate)})` : ""}`);
    return {
      intent: "proveedor",
      answer: `Le debés ${colones(total)} a ${who}: ${lines.join(", ")}.${openFor.length ? ` Ojo: ${openFor.map(alertTitle).join(", ").toLowerCase()} con este proveedor.` : ""}`,
      sources: pend.map((d) => src(d)),
    };
  }

  // ------------------------------------------------ cuánto debo
  if (/\bdebo\b|\bpagar\b|\bpago\b|\bpagos\b|vence|vencid|deuda/.test(q)) {
    const pay = payableDocs(docs).filter((d) => payState(d, today) !== "pagado");
    const overdue = pay.filter((d) => payState(d, today) === "vencido");
    const days = /\bmes\b/.test(q) ? 30 : 7;
    const soon = pay.filter((d) => payState(d, today) === "pendiente" && d.ext.dueDate && daysBetween(today, d.ext.dueDate) <= days);
    const docsUp = upcoming(docs, today).filter((u) => !u.porCobrar);
    const parts: string[] = [];
    if (overdue.length) parts.push(`Tenés ${colones(overdue.reduce((t, d) => t + d.ext.amount!, 0))} vencido (${overdue.map((d) => `${d.ext.counterparty} ${colones(d.ext.amount)}`).join("; ")}).`);
    parts.push(soon.length
      ? `En los próximos ${days} días vence${soon.length === 1 ? "" : "n"} ${colones(soon.reduce((t, d) => t + d.ext.amount!, 0))}: ${soon.map((d) => `${d.ext.counterparty} ${colones(d.ext.amount)} el ${fecha(d.ext.dueDate)}`).join("; ")}.`
      : `No se te vence nada en los próximos ${days} días.`);
    const noAmount = docsUp.filter((u) => u.amount === null);
    if (noAmount.length) parts.push(`Además: ${noAmount.map((u) => u.label).join("; ")}.`);
    parts.push(`En total tenés ${colones(pay.reduce((t, d) => t + d.ext.amount!, 0))} por pagar.`);
    return { intent: "debo", answer: parts.join(" "), sources: [...overdue, ...soon].map((d) => src(d)) };
  }

  // ------------------------------------------------ qué no cuadra
  if (/cuadra|riesgo|alerta|raro|revisar|problema|preocup/.test(q)) {
    if (!open.length) return { intent: "riesgos", answer: "Nada raro por ahora. ✅", sources: [] };
    const top = [...open].sort((a, b) => (b.amountAtRisk ?? 0) - (a.amountAtRisk ?? 0)).slice(0, 5);
    return {
      intent: "riesgos",
      answer: `Tenés ${plural(open.length, "cosa que no cuadra", "cosas que no cuadran")}. Las de más plata: ${top.map((a) => `${alertTitle(a).toLowerCase()} de ${a.counterparty} (${colones(a.amountAtRisk)})`).join("; ")}.`,
      sources: top.map((a) => a.emailIds[0]).filter((id) => byId.has(id)).map((id) => src(byId.get(id)!)),
    };
  }

  return {
    intent: "no_entendi",
    answer: `Todavía no sé responder eso. Probá con: ${SUGGESTED_QUESTIONS.slice(0, 4).map((x) => `"${x}"`).join(", ")}.`,
    sources: [],
  };
}
