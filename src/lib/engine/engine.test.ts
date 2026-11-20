import { describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { parseFactura, parseMensajeHacienda } from "./xml";
import { parseAmounts, parseDueDate } from "./extract";
import { matchLearnedRule, learnedConditionFor, ruleDuplicates, ruleSettlementMismatch, ruleUnusualAmounts, type Doc } from "./rules";
import { parseSettlementCsv, parseSettlementText } from "./settlement";
import { companyCharts } from "./status";
import type { AlertDraft, EmailRecord, Extraction, InvoiceData, SettlementData } from "../types";

const demo = (lote: string, file: string) => path.join(process.cwd(), "data", "bandeja-prueba", lote, file);

async function attachment(lote: string, prefix: string, kind: "FE" | "MH") {
  const files = await fs.readdir(path.join(process.cwd(), "data", "bandeja-prueba", lote));
  const f = files.find((x) => x.startsWith(prefix))!;
  const json = JSON.parse(await fs.readFile(demo(lote, f), "utf8"));
  return json.adjuntos.find((a: { nombre: string }) => a.nombre.startsWith(kind))?.contenido as string | undefined;
}

describe("lector de XML (ADR-0002)", () => {
  it("lee la factura con montos exactos y calcula el vencimiento", async () => {
    const inv = parseFactura((await attachment("lote-1", "03-", "FE"))!)!;
    expect(inv.numericKey).toHaveLength(50);
    expect(inv.docNumber).toHaveLength(20);
    expect(inv.total).toBeCloseTo(184190, 2);
    expect(inv.subtotal + inv.tax).toBeCloseTo(inv.total, 2);
    expect(inv.saleCondition).toBe("credito");
    expect(inv.dueDate).toBe("2026-12-05");
    expect(inv.issuerName).toBe("Distribuidora Ferretera del Valle S.A.");
  });
  it("lee el rechazo de Hacienda", async () => {
    const mh = parseMensajeHacienda((await attachment("lote-1", "14-", "MH"))!)!;
    expect(mh.status).toBe("rechazado");
    expect(mh.detail).toMatch(/Rechazado/);
  });
  it("no rompe con XML inválido", () => {
    expect(parseFactura("<hola>")).toBeNull();
    expect(parseMensajeHacienda("no es xml")).toBeNull();
  });
});

describe("heurísticas de texto", () => {
  it("lee montos en colones con espacios o puntos", () => {
    expect(parseAmounts("por ₡1 248 750 y ₡ 612.300 y ₡96 050,50")).toEqual([1248750, 612300, 96050.5]);
  });
  it("encuentra la fecha de vencimiento en varios formatos", () => {
    expect(parseDueDate("Fecha límite de pago: 26/11/2026.", "2026-11-20")).toBe("2026-11-26");
    expect(parseDueDate("vencen el 15 de diciembre de 2026", "2026-11-20")).toBe("2026-12-15");
    expect(parseDueDate("a más tardar el 25 de noviembre", "2026-11-20")).toBe("2026-11-25");
    expect(parseDueDate("(vencía el 04/11)", "2026-11-20")).toBe("2026-11-04");
    expect(parseDueDate("sin fecha", "2026-11-20")).toBeNull();
  });
});

// ---------------------------------------------------------------- reglas puras
function inv(n: number, issuer: string, total: number, date: string, docNumber = `DOC${n}`, key = `KEY${n}`): Doc {
  const invoice: InvoiceData = {
    numericKey: key, docNumber, issuerName: issuer, issuerTaxId: issuer, receiverTaxId: "X", issuedAt: date + "T08:00:00-06:00",
    saleCondition: "contado", creditDays: 0, dueDate: null, currency: "CRC", subtotal: total / 1.13, tax: total - total / 1.13, total, lines: [],
  };
  const email = { id: `e${n}`, receivedAt: date + "T09:00:00-06:00", sender: issuer } as EmailRecord;
  const ext = { emailId: email.id, category: "proveedores", kind: "factura", invoice, amount: total, status: "pagado", doubtfulFields: [] } as unknown as Extraction;
  return { email, ext };
}

describe("reglas (ADR-0003)", () => {
  it("duplicado exacto = alta; probable = media", () => {
    const docs = [inv(1, "A", 1000, "2026-11-01", "D1", "K1"), inv(2, "A", 1000, "2026-11-10", "D1", "K1"), inv(3, "B", 500, "2026-11-01", "D3", "K3"), inv(4, "B", 500, "2026-11-05", "D4", "K4")];
    const out = ruleDuplicates(docs);
    expect(out.find((a) => a.counterparty === "A")?.confidence).toBe("alta");
    expect(out.find((a) => a.counterparty === "B")?.confidence).toBe("media");
  });
  it("no marca como probable si pasan más de 15 días", () => {
    expect(ruleDuplicates([inv(1, "B", 500, "2026-10-01", "D1", "K1"), inv(2, "B", 500, "2026-11-01", "D2", "K2")])).toHaveLength(0);
  });
  it("monto inusual: alta >2× con 3 previas; media >1.5× con 2 previas; nada con 1 previa", () => {
    const high = ruleUnusualAmounts([inv(1, "C", 100, "2026-10-01"), inv(2, "C", 100, "2026-10-08"), inv(3, "C", 100, "2026-10-15"), inv(4, "C", 250, "2026-10-22")]);
    expect(high[0].confidence).toBe("alta");
    const med = ruleUnusualAmounts([inv(1, "C", 100, "2026-10-01"), inv(2, "C", 100, "2026-10-08"), inv(3, "C", 180, "2026-10-15")]);
    expect(med[0].confidence).toBe("media");
    expect(ruleUnusualAmounts([inv(1, "C", 100, "2026-10-01"), inv(2, "C", 300, "2026-10-08")])).toHaveLength(0);
  });
});

describe("reglas aprendidas (ADR-0007)", () => {
  const unusual = (ratio: number): AlertDraft => ({ key: "k", type: "monto_inusual", confidence: "media", reason: "", ruleApplied: "", emailIds: ["e"], amountAtRisk: 1, counterparty: "P", counterpartyTaxId: "P", meta: { ratio } });
  it("silencia casos parecidos del mismo proveedor, no los mucho mayores", () => {
    const rule = { id: "r", alertType: "monto_inusual" as const, counterpartyTaxId: "P", counterparty: "P", condition: learnedConditionFor(unusual(1.8)), reason: "", createdFrom: "panel" as const, sourceAlertId: "a", createdAt: "", active: true };
    expect(matchLearnedRule(unusual(1.7), [rule])).not.toBeNull();
    expect(matchLearnedRule(unusual(3), [rule])).toBeNull();
    expect(matchLearnedRule({ ...unusual(1.7), counterpartyTaxId: "OTRO" }, [rule])).toBeNull();
  });
  it("nunca silencia un rechazo de Hacienda", () => {
    const rule = { id: "r", alertType: "vencido" as const, counterpartyTaxId: null, counterparty: null, condition: {}, reason: "", createdFrom: "panel" as const, sourceAlertId: "a", createdAt: "", active: true };
    expect(matchLearnedRule({ ...unusual(1), type: "rechazo_hacienda" }, [rule as never])).toBeNull();
  });
});

describe("gráficos del estado (companyCharts)", () => {
  const doc = (id: string, ext: Partial<Extraction>): Doc => ({
    email: { id, externalId: id, source: "demo", sender: "x", subject: "", body: "", receivedAt: "2026-11-01T10:00:00Z", attachments: [], runId: "r", contentHash: id } as EmailRecord,
    ext: { emailId: id, category: "proveedores", kind: "factura", counterparty: "P", counterpartyTaxId: "1", amount: 100, currency: "CRC", dueDate: null, status: "pendiente", summary: "", invoice: null, haciendaStatus: null, haciendaDetail: null, amountSource: "xml", doubtfulFields: [], requestedDocuments: [], extractedBy: "codigo", ...ext },
  });
  const inv = (doc: string): InvoiceData => ({ numericKey: "k" + doc, docNumber: doc, issuerName: "P", issuerTaxId: "1", receiverTaxId: null, issuedAt: "2026-11-01", saleCondition: "credito", creditDays: 30, dueDate: null, currency: "CRC", subtotal: 0, tax: 0, total: 100, lines: [] });

  it("suma lo que debés por tipo, sin contar dos veces una factura duplicada ni lo de clientes", () => {
    const c = companyCharts([
      doc("a", { invoice: inv("001"), haciendaStatus: "aceptado" }),
      doc("b", { invoice: inv("001"), haciendaStatus: "aceptado" }), // mismo consecutivo: duplicado
      doc("c", { category: "ccss", kind: "cobro", amount: 50, invoice: null }),
      doc("d", { category: "clientes", kind: "cobro_pendiente", amount: 999 }),
      doc("e", { status: "pagado", amount: 70 }),
    ], "2026-11-20");
    expect(c.debtByCategory.map((s) => [s.key, s.amount])).toEqual([["proveedores", 100], ["ccss", 50]]);
    expect(c.payments.find((s) => s.key === "pagado")?.amount).toBe(70);
    expect(c.hacienda).toEqual([{ key: "aceptado", label: "Aceptadas", amount: 200, count: 2 }]);
  });

  it("marca como vencido lo que pasó su fecha y agrupa en Otros más allá de 5 tipos", () => {
    const cats = ["proveedores", "hacienda", "ccss", "ins", "bancos", "contador"] as const;
    const c = companyCharts(cats.map((cat, i) => doc(cat, { category: cat, kind: "cobro", amount: 100 - i, dueDate: i === 0 ? "2026-11-01" : null })), "2026-11-20");
    expect(c.debtByCategory).toHaveLength(6);
    expect(c.debtByCategory.at(-1)).toMatchObject({ key: "otros", amount: 95 });
    expect(c.payments.find((s) => s.key === "vencido")?.amount).toBe(100);
  });

  it("reparte lo pendiente por semana de vencimiento", () => {
    const c = companyCharts([
      doc("v", { amount: 10, dueDate: "2026-11-10" }),
      doc("a", { amount: 20, dueDate: "2026-11-22" }),
      doc("b", { amount: 30, dueDate: "2026-11-30" }),
      doc("z", { amount: 40, dueDate: "2027-02-01" }),
      doc("p", { amount: 99, dueDate: "2026-11-22", status: "pagado" }),
    ], "2026-11-20");
    const by = Object.fromEntries(c.dueByWeek.map((w) => [w.key, w.amount]));
    expect(by).toEqual({ vencido: 10, w0: 20, w1: 30, w2: 0, w3: 0, later: 40 });
  });
});

describe("cierres del datáfono y de facturación", () => {
  async function demoFile(suffix: string) {
    const files = await fs.readdir(path.join(process.cwd(), "data", "bandeja-prueba", "lote-1"));
    const f = files.find((x) => x.endsWith(suffix))!;
    return JSON.parse(await fs.readFile(demo("lote-1", f), "utf8")) as { asunto: string; cuerpo: string; adjuntos: { contenido: string }[] };
  }

  it("lee los CSV de la bandeja de prueba con montos exactos", async () => {
    const caja = parseSettlementCsv((await demoFile("cierre-caja-17.json")).adjuntos[0].contenido)!;
    const pos = parseSettlementCsv((await demoFile("cierre-datafono-17.json")).adjuntos[0].contenido)!;
    expect(caja).toMatchObject({ source: "facturacion", date: "2026-11-17", card: 412300, fromFile: true });
    expect(caja.total).toBe((caja.cash ?? 0) + caja.card + (caja.sinpe ?? 0));
    expect(pos).toMatchObject({ source: "datafono", date: "2026-11-17", card: 367300, fromFile: true });
    expect(pos.deposit).toBe(pos.card - pos.commission!);
  });

  it("si no viene el CSV, lee las líneas rotuladas del correo", async () => {
    const pos = await demoFile("cierre-datafono-17.json");
    expect(parseSettlementText(pos.asunto, pos.cuerpo)).toMatchObject({ source: "datafono", date: "2026-11-17", card: 367300, fromFile: false });
    const caja = await demoFile("cierre-caja-17.json");
    expect(parseSettlementText(caja.asunto, caja.cuerpo)).toMatchObject({ source: "facturacion", card: 412300, fromFile: false });
    expect(parseSettlementCsv(["hola,mundo", "1,2"].join("\n"))).toBeNull();
  });

  const st = (source: "datafono" | "facturacion", date: string, card: number, fromFile = true): SettlementData => ({
    source, date, card, cash: source === "facturacion" ? 100000 : null, sinpe: source === "facturacion" ? 50000 : null,
    total: source === "facturacion" ? card + 150000 : card, commission: null, deposit: null, transactions: null, invoices: 30, batch: null, fromFile,
  });
  const sdoc = (id: string, s: SettlementData, at = "2026-11-17T20:00:00-06:00"): Doc => ({
    email: { id, externalId: id, source: "demo", sender: "x", subject: "", body: "", receivedAt: at, attachments: [], runId: "r", contentHash: id } as EmailRecord,
    ext: { emailId: id, category: "ventas", kind: s.source === "datafono" ? "cierre_datafono" : "cierre_ventas", counterparty: s.source === "datafono" ? "Banco" : "Software", counterpartyTaxId: null, amount: s.card, currency: "CRC", dueDate: null, status: "informativo", summary: "", invoice: null, haciendaStatus: null, haciendaDetail: null, amountSource: "archivo", doubtfulFields: [], requestedDocuments: [], extractedBy: "codigo", settlement: s },
  });

  it("alerta con confianza alta cuando faltan colones en el datáfono", () => {
    const [a] = ruleSettlementMismatch([sdoc("c", st("facturacion", "2026-11-17", 412300)), sdoc("d", st("datafono", "2026-11-17", 367300))]);
    expect(a).toMatchObject({ type: "cierre_descuadre", confidence: "alta", amountAtRisk: 45000, emailIds: ["c", "d"] });
    expect(a.meta.direction).toBe("faltante");
  });

  it("no alerta si cuadra o la diferencia es de redondeo; tampoco si falta uno de los dos cierres", () => {
    expect(ruleSettlementMismatch([sdoc("c", st("facturacion", "2026-11-17", 400000)), sdoc("d", st("datafono", "2026-11-17", 400000))])).toEqual([]);
    expect(ruleSettlementMismatch([sdoc("c", st("facturacion", "2026-11-17", 400000)), sdoc("d", st("datafono", "2026-11-17", 399200))])).toEqual([]);
    expect(ruleSettlementMismatch([sdoc("c", st("facturacion", "2026-11-17", 400000)), sdoc("d", st("datafono", "2026-11-18", 300000))])).toEqual([]);
  });

  it("si alguno se leyó del texto baja a confianza media; si el datáfono cobró de más es 'sobrante'", () => {
    const [a] = ruleSettlementMismatch([sdoc("c", st("facturacion", "2026-11-17", 300000)), sdoc("d", st("datafono", "2026-11-17", 350000, false))]);
    expect(a).toMatchObject({ confidence: "media", amountAtRisk: 50000 });
    expect(a.meta.direction).toBe("sobrante");
  });

  it("'es normal' en un descuadre aprende un tope de diferencia", () => {
    const [a] = ruleSettlementMismatch([sdoc("c", st("facturacion", "2026-11-17", 412300)), sdoc("d", st("datafono", "2026-11-17", 367300))]);
    const cond = learnedConditionFor(a);
    expect(cond.maxDiff).toBe(54000);
    const rule = { id: "r", alertType: "cierre_descuadre", counterpartyTaxId: null, counterparty: "Banco", condition: cond, reason: "", createdFrom: "panel", sourceAlertId: a.key, createdAt: "", active: true } as const;
    expect(matchLearnedRule(a, [rule])).not.toBeNull();
    expect(matchLearnedRule({ ...a, amountAtRisk: 90000 }, [rule])).toBeNull();
  });

  it("ventas por día y por medio de pago salen del cierre de caja", () => {
    const c = companyCharts([
      sdoc("c1", st("facturacion", "2026-11-16", 200000)),
      sdoc("c2", st("facturacion", "2026-11-17", 300000)),
      sdoc("d1", st("datafono", "2026-11-17", 300000)),
    ], "2026-11-20");
    expect(c.salesByDay.map((d) => [d.label, d.amount])).toEqual([["16/11", 350000], ["17/11", 450000]]);
    expect(Object.fromEntries(c.salesByMethod.map((m) => [m.key, m.amount]))).toEqual({ efectivo: 200000, tarjeta: 500000, sinpe: 100000 });
    expect(c.debtByCategory).toEqual([]); // los cierres no son deudas
  });
});
