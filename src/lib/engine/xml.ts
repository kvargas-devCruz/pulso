// Lector determinista de comprobantes electrónicos de Hacienda (ADR-0002).
// Los montos, la clave y el estado salen de aquí, nunca de la IA.
import { XMLParser } from "fast-xml-parser";
import type { HaciendaMessage, InvoiceData } from "../types";

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  parseTagValue: false, // claves de 50 dígitos y consecutivos deben quedar como texto
  trimValues: true,
});

type Node = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}
function str(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}
function num(v: unknown): number {
  const n = Number(str(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function root(xml: string): Node | null {
  try {
    return parser.parse(xml) as Node;
  } catch {
    return null;
  }
}

export function isFacturaXml(xml: string): boolean {
  const r = root(xml);
  return !!r && ("FacturaElectronica" in r || "TiqueteElectronico" in r);
}

export function isMensajeHaciendaXml(xml: string): boolean {
  const r = root(xml);
  return !!r && "MensajeHacienda" in r;
}

/** Lee una FacturaElectronica (v4.3/v4.4). Devuelve null si no es una factura válida. */
export function parseFactura(xml: string): InvoiceData | null {
  const r = root(xml);
  const f = (r?.["FacturaElectronica"] ?? r?.["TiqueteElectronico"]) as Node | undefined;
  if (!f) return null;
  const emisor = (f["Emisor"] ?? {}) as Node;
  const receptor = (f["Receptor"] ?? {}) as Node;
  const resumen = (f["ResumenFactura"] ?? {}) as Node;
  const moneda = (resumen["CodigoTipoMoneda"] ?? {}) as Node;
  const detalle = (f["DetalleServicio"] ?? {}) as Node;
  const issuedAt = str(f["FechaEmision"]);
  const condition = str(f["CondicionVenta"]) === "02" ? "credito" : "contado";
  const creditDays = condition === "credito" ? Math.round(num(f["PlazoCredito"])) : 0;
  const numericKey = str(f["Clave"]);
  const docNumber = str(f["NumeroConsecutivo"]);
  const total = num(resumen["TotalComprobante"]);
  if (!numericKey || !docNumber || !issuedAt) return null;

  return {
    numericKey,
    docNumber,
    issuerName: str(emisor["Nombre"]),
    issuerTaxId: str((emisor["Identificacion"] as Node | undefined)?.["Numero"]),
    receiverTaxId: str((receptor["Identificacion"] as Node | undefined)?.["Numero"]) || null,
    issuedAt,
    saleCondition: condition,
    creditDays,
    dueDate: condition === "credito" && creditDays > 0 ? addDays(issuedAt, creditDays) : null,
    currency: str(moneda["CodigoMoneda"]) || "CRC",
    subtotal: num(resumen["TotalVentaNeta"]),
    tax: num(resumen["TotalImpuesto"]),
    total,
    lines: asArray(detalle["LineaDetalle"] as Node | Node[]).map((l) => ({
      detail: str(l["Detalle"]),
      quantity: num(l["Cantidad"]),
      unitPrice: num(l["PrecioUnitario"]),
      total: num(l["MontoTotalLinea"]),
    })),
  };
}

/** Lee la respuesta de Hacienda. Mensaje 1 = aceptado; 3 = rechazado (2 = aceptado parcial → aceptado). */
export function parseMensajeHacienda(xml: string): HaciendaMessage | null {
  const r = root(xml);
  const m = r?.["MensajeHacienda"] as Node | undefined;
  if (!m) return null;
  const code = str(m["Mensaje"]);
  const numericKey = str(m["Clave"]);
  if (!numericKey || !code) return null;
  return {
    numericKey,
    status: code === "3" ? "rechazado" : "aceptado",
    detail: str(m["DetalleMensaje"]),
  };
}
