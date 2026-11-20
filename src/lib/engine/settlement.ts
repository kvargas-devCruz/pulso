// Cierres diarios (ADR-0002: los números salen de código).
// - Datáfono (banco): fecha, lote, transacciones, monto bruto, comisión y neto a depositar.
// - Software de facturación: fecha, facturas emitidas y ventas por medio de pago.
// Primero se lee el CSV adjunto (exacto). Si no hay CSV, se leen las líneas rotuladas
// del cuerpo del correo (fromFile = false → confianza más baja en la regla).
import type { EmailRecord, SettlementData } from "../types";

const DATAFONO_HEADER = ["fecha", "lote", "transacciones", "monto_bruto", "comision", "neto_depositar"];
const CAJA_HEADER = ["fecha", "facturas_emitidas", "efectivo", "tarjeta", "sinpe", "total"];

const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const n = Number(s.trim());
  return Number.isFinite(n) ? n : null;
};

function parseCsv(text: string): { header: string[]; row: string[] } | null {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const row = lines[1].split(",").map((c) => c.trim());
  return row.length === header.length ? { header, row } : null;
}

const sameHeader = (a: string[], b: string[]) => a.length === b.length && a.every((h, i) => h === b[i]);

/** Lee un CSV de cierre. Devuelve null si no es un cierre reconocido o le faltan montos. */
export function parseSettlementCsv(text: string): SettlementData | null {
  const csv = parseCsv(text);
  if (!csv) return null;
  const get = (k: string) => csv.row[csv.header.indexOf(k)];
  const date = get("fecha");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return null;

  if (sameHeader(csv.header, DATAFONO_HEADER)) {
    const card = num(get("monto_bruto"));
    if (card === null) return null;
    return {
      source: "datafono", date, card, cash: null, sinpe: null, total: card,
      commission: num(get("comision")), deposit: num(get("neto_depositar")),
      transactions: num(get("transacciones")), invoices: null, batch: get("lote") ?? null, fromFile: true,
    };
  }
  if (sameHeader(csv.header, CAJA_HEADER)) {
    const card = num(get("tarjeta"));
    const total = num(get("total"));
    if (card === null || total === null) return null;
    return {
      source: "facturacion", date, card, cash: num(get("efectivo")), sinpe: num(get("sinpe")), total,
      commission: null, deposit: null, transactions: null, invoices: num(get("facturas_emitidas")), batch: null, fromFile: true,
    };
  }
  return null;
}

// ---------------------------------------------------------------- texto del correo (respaldo)
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** "₡412 300", "₡1 248 750,50" o "412.300" → número. */
function amountAfter(label: RegExp, text: string): number | null {
  const m = text.match(new RegExp(`(?:${label.source})` + String.raw`\s*:?\s*₡?\s*(\d[\d .]*(?:,\d{1,2})?)`, "i"));
  if (!m) return null;
  const n = Number(m[1].replace(/[ .]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function dateIn(text: string): string | null {
  const m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Cierre leído de las líneas rotuladas del cuerpo, cuando no viene el CSV. */
export function parseSettlementText(subject: string, body: string): SettlementData | null {
  const s = norm(subject);
  const date = dateIn(subject) ?? dateIn(body);
  if (!date) return null;
  if (/cierre de lote|datafono/.test(s)) {
    const card = amountAfter(/monto bruto/, norm(body));
    if (card === null) return null;
    return {
      source: "datafono", date, card, cash: null, sinpe: null, total: card,
      commission: amountAfter(/comision/, norm(body)), deposit: amountAfter(/neto a depositar/, norm(body)),
      transactions: null, invoices: null, batch: null, fromFile: false,
    };
  }
  if (/cierre de caja/.test(s)) {
    const b = norm(body);
    const card = amountAfter(/tarjeta/, b);
    const total = amountAfter(/total vendido|total/, b);
    if (card === null || total === null) return null;
    return {
      source: "facturacion", date, card, cash: amountAfter(/efectivo/, b), sinpe: amountAfter(/sinpe(?: movil)?/, b), total,
      commission: null, deposit: null, transactions: null, invoices: null, batch: null, fromFile: false,
    };
  }
  return null;
}

/** El cierre de un correo: primero el CSV adjunto; si no, el texto. */
export function settlementFromEmail(email: EmailRecord): SettlementData | null {
  for (const a of email.attachments) {
    if (!a.content) continue;
    if (a.type === "text/csv" || a.name.toLowerCase().endsWith(".csv")) {
      const s = parseSettlementCsv(a.content);
      if (s) return s;
    }
  }
  return parseSettlementText(email.subject, email.body);
}
