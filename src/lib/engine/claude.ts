// Uso de Claude: solo donde no hay estructura (correos sin XML). Nunca para montos que vienen del XML.
// Salida en JSON validada con zod; si no valida, se reintenta una vez y si no, se devuelve null
// (el llamador usa la heurística y marca los campos como dudosos).
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { EmailRecord, Extraction } from "../types";
import type { ExtractContext } from "./extract";
import { senderName } from "./extract";

export function claudeEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.PULSO_USE_CLAUDE !== "0";
}

const MODEL = () => process.env.PULSO_MODEL || "claude-sonnet-5-5";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const Schema = z.object({
  category: z.enum(["hacienda", "ccss", "ins", "bancos", "proveedores", "clientes", "contador", "ventas", "ruido"]),
  kind: z.enum(["aviso", "cobro", "solicitud", "pago_recibido", "cobro_pendiente", "ruido"]),
  counterparty: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().default("CRC"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: z.enum(["pendiente", "pagado", "vencido", "informativo"]),
  summary: z.string(),
  requestedDocuments: z.array(z.string()).default([]),
  doubtfulFields: z.array(z.string()).default([]),
});

const SYSTEM = `Sos el extractor de Pulso, un agente que lee el correo de una pyme de Costa Rica.
Recibís UN correo sin factura XML. Devolvé SOLO un objeto JSON con estos campos:
- category: hacienda | ccss | ins | bancos | proveedores | clientes | contador | ventas | ruido
  (ventas = cierres de caja o del datáfono y reportes de ventas del día; usá kind "aviso" y status "informativo")
  (clientes = alguien que le debe o le pagó a la empresa; proveedores = alguien a quien la empresa le compra o le debe;
   ruido = promociones, boletines, publicidad)
- kind: aviso | cobro | solicitud | pago_recibido | cobro_pendiente | ruido
  (cobro = le piden pagar a la empresa; cobro_pendiente = un cliente le debe a la empresa;
   solicitud = le piden documentos o una acción; pago_recibido = un cliente le pagó)
- counterparty: nombre de la otra parte o null
- amount: monto principal en número (sin símbolo) o null. NO inventes montos: si no aparece, null.
- currency: "CRC" o "USD"
- dueDate: fecha límite en formato YYYY-MM-DD o null. Si no trae año, usá el año de "hoy".
- status: pendiente | pagado | vencido | informativo (vencido si la fecha límite ya pasó y no está pagado)
- summary: una línea en español de Costa Rica (voseo), máximo 120 caracteres
- requestedDocuments: lista de documentos que piden (si aplica)
- doubtfulFields: campos de los que no estás seguro
No agregues texto fuera del JSON.`;

function firstJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("sin JSON");
  return JSON.parse(text.slice(start, end + 1));
}

export async function extractWithClaude(email: EmailRecord, ctx: ExtractContext): Promise<Extraction | null> {
  const known = ctx.contacts.map((c) => `${c.name} (${c.domain})`).join("; ") || "ninguno";
  const user = `Hoy: ${ctx.today}
Contactos conocidos (por facturas anteriores): ${known}
---
De: ${email.sender}
Asunto: ${email.subject}
Fecha: ${email.receivedAt}

${email.body.slice(0, 6000)}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await anthropic().messages.create({
      model: MODEL(),
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try {
      const parsed = Schema.parse(firstJson(text));
      return {
        emailId: email.id,
        category: parsed.category,
        kind: parsed.category === "ruido" ? "ruido" : parsed.kind,
        counterparty: parsed.category === "ruido" ? null : parsed.counterparty ?? senderName(email.sender),
        counterpartyTaxId: null,
        amount: parsed.amount,
        currency: parsed.currency,
        dueDate: parsed.dueDate,
        status: parsed.status,
        summary: parsed.summary,
        invoice: null,
        haciendaStatus: null,
        haciendaDetail: null,
        amountSource: parsed.amount !== null ? "ia" : null,
        doubtfulFields: parsed.doubtfulFields,
        requestedDocuments: parsed.requestedDocuments,
        extractedBy: "claude",
      };
    } catch {
      // reintento una vez
    }
  }
  return null;
}

/** Redacción opcional con Claude (frases y borradores). Si no hay key o falla, devuelve el texto base. */
export async function polish(base: string, instruction: string): Promise<string> {
  if (!claudeEnabled()) return base;
  try {
    const res = await anthropic().messages.create({
      model: process.env.PULSO_MODEL_FAST || "claude-haiku-5-5",
      max_tokens: 600,
      system:
        "Reescribís textos cortos para Pulso en español de Costa Rica (voseo), claros y amables. " +
        "NO cambies montos, fechas, nombres ni números. Devolvé solo el texto final.",
      messages: [{ role: "user", content: `${instruction}\n\nTexto base:\n${base}` }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    // Guardia: todos los números del texto base deben seguir apareciendo igual (ADR-0002).
    const digits = (s: string) => (s.match(/\d+/g) ?? []).join("|");
    const baseNums = new Set((base.match(/\d+/g) ?? []));
    const outNums = new Set((text.match(/\d+/g) ?? []));
    const sameNumbers = [...baseNums].every((n) => outNums.has(n)) && digits(text).length > 0 === digits(base).length > 0;
    return text && sameNumbers ? text : base;
  } catch {
    return base;
  }
}
