// Textos que ve el dueño: explicación de cada alerta, borradores de acción y mensajes de WhatsApp.
// Se arman con plantillas a partir de los datos de la regla (los números nunca los inventa la IA).
import type { Action, ActionKind, Alert, AlertDraft, Company, Extraction } from "../types";
import { colones, fecha } from "../format";

const TYPE_LABEL: Record<AlertDraft["type"], string> = {
  duplicado: "Posible factura duplicada",
  monto_inusual: "Monto fuera de lo normal",
  cobro_sin_factura: "Cobro sin factura",
  rechazo_hacienda: "Factura rechazada por Hacienda",
  vencido: "Vencido",
};
export const alertTitle = (a: AlertDraft) =>
  a.type === "vencido" && a.meta.porCobrar ? "Cobro pendiente vencido" : TYPE_LABEL[a.type];

export function explain(a: AlertDraft): string {
  switch (a.type) {
    case "duplicado":
      return a.confidence === "alta"
        ? `${a.counterparty} envió la misma factura más de una vez. Si se paga dos veces, perdés ${colones(a.amountAtRisk)}.`
        : `${a.counterparty} envió dos facturas por el mismo monto en pocos días. Puede ser un pedido real o un cobro repetido: vale la pena confirmarlo.`;
    case "monto_inusual":
      return `${a.counterparty} cobró ${Number(a.meta.ratio).toFixed(1)} veces lo que suele cobrar. Si no hiciste un pedido más grande, conviene preguntar.`;
    case "rechazo_hacienda":
      return `Hacienda rechazó esta factura de ${a.counterparty}. Mientras no la corrijan, no la podés usar como gasto ni para el crédito de IVA.`;
    case "cobro_sin_factura":
      return `${a.counterparty} pide un pago de ${colones(a.amountAtRisk)}, pero no hay ninguna factura electrónica que lo respalde. Antes de pagar, pedí la factura.`;
    case "vencido":
      return a.meta.porCobrar
        ? `${a.counterparty} todavía no te paga. Un recordatorio amable suele ser suficiente.`
        : `Este pago ya venció. Pagarlo pronto evita intereses o recargos.`;
  }
}

function emailAddress(sender: string | undefined): string | null {
  const m = sender?.match(/<([^>]+)>/);
  return m ? m[1] : sender ?? null;
}

export function draftAction(
  alert: Alert,
  company: Company,
  ext: Extraction | undefined,
  sender: string | undefined,
): Omit<Action, "id" | "createdAt"> | null {
  const firma = `Saludos,\n${company.name}`;
  const docNumber = ext?.invoice?.docNumber ?? (alert.meta.docNumber as string | undefined);
  let kind: ActionKind = "correo_proveedor";
  let subject = "";
  let body = "";

  switch (alert.type) {
    case "duplicado":
      subject = `Consulta sobre factura ${docNumber ?? ""} recibida dos veces`.trim();
      body =
        `Hola, equipo de ${alert.counterparty}:\n\n` +
        (alert.confidence === "alta"
          ? `Recibimos la factura N.° ${docNumber} por ${colones(alert.amountAtRisk)} en más de una ocasión. Entendemos que es el mismo documento y que solo corresponde pagarla una vez. ¿Nos confirman, por favor?`
          : `Recibimos dos facturas por el mismo monto (${colones(Number(alert.meta.amount))}) con pocos días de diferencia (N.° ${(alert.meta.docNumbers as string[] | undefined)?.join(" y ")}). ¿Nos confirman si corresponden a dos pedidos distintos?`) +
        `\n\n${firma}`;
      break;
    case "monto_inusual":
      subject = `Consulta sobre el monto de la factura ${docNumber ?? ""}`.trim();
      body =
        `Hola, equipo de ${alert.counterparty}:\n\n` +
        `La factura N.° ${docNumber} trae un monto mayor al habitual (${colones(ext?.amount)}, cuando normalmente rondamos ${colones(Number(alert.meta.average))}). ¿Nos ayudan a confirmar las cantidades y los precios?\n\n${firma}`;
      break;
    case "rechazo_hacienda":
      subject = `Factura ${docNumber ?? ""} rechazada por Hacienda`.trim();
      body =
        `Hola, equipo de ${alert.counterparty}:\n\n` +
        `La factura N.° ${docNumber} por ${colones(alert.amountAtRisk)} aparece como RECHAZADA por Hacienda (${String(alert.meta.detail ?? "sin detalle")}). ¿Nos pueden emitir una nueva factura corregida, por favor?\n\n${firma}`;
      break;
    case "cobro_sin_factura":
      subject = "Solicitud de factura electrónica";
      body =
        `Hola, equipo de ${alert.counterparty}:\n\n` +
        `Recibimos su solicitud de pago por ${colones(alert.amountAtRisk)}, pero no tenemos la factura electrónica correspondiente. ¿Nos la pueden enviar para poder procesar el pago?\n\n${firma}`;
      break;
    case "vencido":
      if (alert.meta.porCobrar) {
        kind = "cobro";
        subject = "Recordatorio de pago pendiente";
        body =
          `Hola, ${alert.counterparty}:\n\n` +
          `Les recordamos amablemente el pago pendiente de ${colones(alert.amountAtRisk)}, que venció el ${fecha(alert.meta.dueDate as string)}. Si ya lo realizaron, por favor ignoren este mensaje y envíennos el comprobante.\n\n${firma}`;
      } else {
        kind = "recordatorio";
        subject = `Recordatorio: pagar ${alert.counterparty}`;
        body = `Recordatorio interno: pagar ${colones(alert.amountAtRisk)} a ${alert.counterparty} (venció el ${fecha(alert.meta.dueDate as string)}).`;
        return { alertId: alert.id, kind, to: null, subject, draft: body, status: "pendiente", approvedVia: null, approvedAt: null, gmailDraftId: null };
      }
      break;
  }
  return { alertId: alert.id, kind, to: emailAddress(sender), subject, draft: body, status: "pendiente", approvedVia: null, approvedAt: null, gmailDraftId: null };
}

export function whatsappAlertText(alerts: Alert[], appUrl: string): string {
  const lines = alerts.slice(0, 3).map((a) => {
    const conf = a.confidence === "alta" ? "confianza alta" : "confianza media";
    return `⚠️ *${alertTitle(a)}* (${conf})\n${a.counterparty ?? ""}${a.amountAtRisk ? ` · ${colones(a.amountAtRisk)} en riesgo` : ""}\n${a.reason}`;
  });
  const extra = alerts.length > 3 ? `\n…y ${alerts.length - 3} más en el panel.` : "";
  const first = alerts[0];
  return (
    `*Pulso* 🫀\n\n${lines.join("\n\n")}${extra}\n\n` +
    `Respondé *1* para preparar el correo${first ? ` a ${first.counterparty}` : ""}, *2* si es normal, o *VER* para el detalle.\n${appUrl}`
  );
}
