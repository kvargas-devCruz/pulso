// Extracción: qué entiende Pulso de cada correo.
// 1) Facturas: XML con código (exacto). 2) Respuesta de Hacienda: XML con código.
// 3) Cierres del datáfono y del software de facturación: CSV con código (o sus líneas rotuladas).
// 4) Resto del correo: Claude si hay API key; si no (o si falla), heurística determinista.
import type { EmailRecord, Extraction, InvoiceData, HaciendaMessage, Category, ItemKind, ItemStatus, SettlementData } from "../types";
import { settlementFromEmail } from "./settlement";
import { colones } from "../format";
import { isFacturaXml, isMensajeHaciendaXml, parseFactura, parseMensajeHacienda } from "./xml";
import { extractWithClaude, claudeEnabled } from "./claude";

export interface Contact {
  name: string;
  taxId: string | null;
  domain: string;
}

export interface ExtractContext {
  companyTaxId: string;
  today: string; // YYYY-MM-DD
  /** Directorio armado con las facturas ya vistas: dominio de correo → emisor. */
  contacts: Contact[];
  /** Respuestas de Hacienda vistas en cualquier correo, por clave. */
  haciendaByKey: Map<string, HaciendaMessage>;
}

// ------------------------------------------------------------------ utilidades
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function senderName(sender: string): string {
  const m = sender.match(/^\s*"?([^"<]+?)"?\s*<.+>\s*$/);
  return (m ? m[1] : sender).trim();
}
export function senderDomain(sender: string): string {
  const m = sender.match(/@([^>\s]+)/);
  return (m ? m[1] : "").toLowerCase();
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const pad = (n: number) => String(n).padStart(2, "0");

/** Montos en colones: ₡1 248 750 · ₡ 612.300 · ₡96 050,50 */
export function parseAmounts(text: string): number[] {
  const re = /₡\s?(\d{1,3}(?:[ . ]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g;
  const out: number[] = [];
  for (const m of text.matchAll(re)) {
    const n = Number(m[1].replace(/[ . ]/g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

/** Fecha de vencimiento: primera fecha que sigue a una palabra de vencimiento. */
export function parseDueDate(text: string, today: string): string | null {
  const t = norm(text);
  const year = Number(today.slice(0, 4));
  const kw = /(vence|vencen|vencio|vencia|vencimiento|fecha limite(?: de pago)?|a mas tardar|antes del|plazo hasta)/g;
  for (const k of t.matchAll(kw)) {
    const tail = t.slice((k.index ?? 0) + k[0].length, (k.index ?? 0) + k[0].length + 60);
    const d1 = tail.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    const d2 = tail.match(/(\d{1,2}) de ([a-z]+)(?: de (\d{4}))?/);
    const i1 = d1?.index ?? Infinity;
    const i2 = d2 && MESES[d2[2]] ? (d2.index ?? Infinity) : Infinity;
    if (i1 === Infinity && i2 === Infinity) continue;
    if (i1 <= i2 && d1) {
      const y = d1[3] ? (d1[3].length === 2 ? 2000 + Number(d1[3]) : Number(d1[3])) : year;
      return `${y}-${pad(Number(d1[2]))}-${pad(Number(d1[1]))}`;
    }
    if (d2) {
      const y = d2[3] ? Number(d2[3]) : year;
      return `${y}-${pad(MESES[d2[2]])}-${pad(Number(d2[1]))}`;
    }
  }
  return null;
}

function requestedDocs(body: string): string[] {
  return [...body.matchAll(/^\s*\d+[.)]\s+(.+)$/gm)].map((m) => m[1].trim().replace(/\.$/, ""));
}

// ------------------------------------------------------------------ facturas
function invoiceExtraction(
  email: EmailRecord,
  inv: InvoiceData,
  ctx: ExtractContext,
): Extraction {
  const isSale = inv.issuerTaxId === ctx.companyTaxId;
  const mh = ctx.haciendaByKey.get(inv.numericKey);
  let status: ItemStatus = inv.saleCondition === "contado" ? "pagado" : "pendiente";
  if (status === "pendiente" && inv.dueDate && inv.dueDate < ctx.today) status = "vencido";
  return {
    emailId: email.id,
    category: isSale ? "clientes" : "proveedores",
    kind: "factura",
    counterparty: inv.issuerName,
    counterpartyTaxId: inv.issuerTaxId,
    amount: inv.total,
    currency: inv.currency,
    dueDate: inv.dueDate,
    status,
    summary: `Factura ${inv.docNumber} de ${inv.issuerName}${inv.saleCondition === "contado" ? " (contado)" : ` (crédito ${inv.creditDays} días)`}`,
    invoice: inv,
    haciendaStatus: mh ? mh.status : "sin_respuesta",
    haciendaDetail: mh ? mh.detail : null,
    amountSource: "xml",
    doubtfulFields: [],
    requestedDocuments: [],
    extractedBy: "codigo",
  };
}

// ------------------------------------------------------------------ cierres
function settlementExtraction(email: EmailRecord, st: SettlementData): Extraction {
  const pos = st.source === "datafono";
  const [y, m, d] = st.date.split("-");
  return {
    emailId: email.id,
    category: "ventas",
    kind: pos ? "cierre_datafono" : "cierre_ventas",
    counterparty: senderName(email.sender),
    counterpartyTaxId: null,
    amount: pos ? st.card : st.total,
    currency: "CRC",
    dueDate: null,
    status: "informativo",
    summary: pos
      ? `Cierre del datáfono del ${d}/${m}/${y}: ${colones(st.card)} con tarjeta${st.deposit !== null ? `, deposita ${colones(st.deposit)}` : ""}`
      : `Cierre de caja del ${d}/${m}/${y}: vendiste ${colones(st.total)} (tarjeta ${colones(st.card)})`,
    invoice: null,
    haciendaStatus: null,
    haciendaDetail: null,
    amountSource: st.fromFile ? "archivo" : "heuristica",
    doubtfulFields: st.fromFile ? [] : ["monto leído del texto del correo"],
    requestedDocuments: [],
    extractedBy: st.fromFile ? "codigo" : "heuristica",
    settlement: st,
  };
}

// ------------------------------------------------------------------ heurística
export function heuristicExtraction(email: EmailRecord, ctx: ExtractContext): Extraction {
  const name = senderName(email.sender);
  const domain = senderDomain(email.sender);
  const from = norm(email.sender);
  const subject = norm(email.subject);
  const body = norm(email.body);
  const all = `${subject}\n${body}`;
  const contact = ctx.contacts.find((c) => c.domain && c.domain === domain);

  let category: Category;
  if (/(promo|oferta|black friday|boletin|webinar|newsletter|descuento|suscrib)/.test(from + " " + subject)) category = "ruido";
  else if (/(hacienda|tribu-?cr|tributacion)/.test(from)) category = "hacienda";
  else if (/(ccss|sicere|caja costarricense)/.test(from)) category = "ccss";
  else if (/(\bins\b|instituto nacional de seguros)/.test(from) || /^ins /.test(norm(name))) category = "ins";
  else if (/(banco|\bbac\b|\bbcr\b|scotiabank|davivienda|promerica|coopenae)/.test(from)) category = "bancos";
  else if (contact && /(contador|contable|contabilidad)/.test(norm(contact.name))) category = "contador";
  else if (/(contador|contable|contabilidad)/.test(from)) category = "contador";
  else if (/(comprobante de (pago|la transferencia)|recibimos su factura|estaremos pagando|les pagamos|disculpen el atraso)/.test(all)) category = "clientes";
  else category = "proveedores";

  const amounts = parseAmounts(email.body);
  const amount = amounts[0] ?? null;
  const dueDate = parseDueDate(email.subject + "\n" + email.body, ctx.today);
  const paid = /(quedo cancelad|ya (fue |esta )?pagad|fue cancelad|pago aplicado)/.test(body);

  let kind: ItemKind;
  if (category === "ruido") kind = "ruido";
  else if (category === "clientes")
    kind = /(atraso|estaremos pagando|pagaremos|pendiente)/.test(all) ? "cobro_pendiente" : "pago_recibido";
  else if (paid) kind = "aviso";
  else if (/(necesito|favor (enviar|remitir)|me (envie|pase)|documentos pendientes|requiero)/.test(all)) kind = "solicitud";
  else if (amount !== null && /(pago|cuota|cuotas|renovacion|depositar|facturacion|a pagar|cobro|vence|vencio)/.test(all)) kind = "cobro";
  else kind = "aviso";

  let status: ItemStatus;
  if (kind === "ruido") status = "informativo";
  else if (kind === "pago_recibido" || paid) status = "pagado";
  else if ((kind === "cobro" || kind === "cobro_pendiente") && ((dueDate && dueDate < ctx.today) || /no registra pago/.test(body))) status = "vencido";
  else if (kind === "aviso" && !dueDate && amount === null) status = "informativo";
  else status = "pendiente";

  const counterparty =
    category === "hacienda" ? "Ministerio de Hacienda"
    : category === "ccss" ? "CCSS"
    : category === "ins" ? "INS"
    : contact ? contact.name
    : name;

  return {
    emailId: email.id,
    category,
    kind,
    counterparty: category === "ruido" ? null : counterparty,
    counterpartyTaxId: contact?.taxId ?? null,
    amount: category === "ruido" ? null : amount,
    currency: "CRC",
    dueDate: category === "ruido" ? null : dueDate,
    status,
    summary: email.subject,
    invoice: null,
    haciendaStatus: null,
    haciendaDetail: null,
    amountSource: amount !== null && category !== "ruido" ? "heuristica" : null,
    doubtfulFields: [],
    requestedDocuments: kind === "solicitud" ? requestedDocs(email.body) : [],
    extractedBy: "heuristica",
  };
}

// ------------------------------------------------------------------ entrada principal
export function invoicesFromEmail(email: EmailRecord): InvoiceData[] {
  return email.attachments
    .filter((a) => a.content && isFacturaXml(a.content))
    .map((a) => parseFactura(a.content!))
    .filter((x): x is InvoiceData => !!x);
}

export function haciendaMessagesFromEmail(email: EmailRecord): HaciendaMessage[] {
  return email.attachments
    .filter((a) => a.content && isMensajeHaciendaXml(a.content))
    .map((a) => parseMensajeHacienda(a.content!))
    .filter((x): x is HaciendaMessage => !!x);
}

export async function extractEmail(email: EmailRecord, ctx: ExtractContext): Promise<Extraction> {
  const invoice = invoicesFromEmail(email)[0];
  if (invoice) return invoiceExtraction(email, invoice, ctx);
  const settlement = settlementFromEmail(email);
  if (settlement) return settlementExtraction(email, settlement);
  if (claudeEnabled()) {
    try {
      const fromClaude = await extractWithClaude(email, ctx);
      if (fromClaude) return fromClaude;
    } catch (err) {
      console.warn(`[pulso] Claude falló con ${email.externalId}; uso heurística.`, err);
    }
  }
  return heuristicExtraction(email, ctx);
}
