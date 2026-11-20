// Tipos del dominio de Pulso. Nombres en inglés; valores visibles en español.

export type Source = "demo" | "gmail";

export interface Attachment {
  name: string;
  type: string; // MIME
  content: string | null; // texto (XML) o null si no se trae (p. ej. PDF en la demo)
}

/** Correo tal como lo entrega un adaptador (ADR-0001). */
export interface RawEmail {
  externalId: string;
  source: Source;
  sender: string;
  subject: string;
  body: string;
  receivedAt: string; // ISO
  attachments: Attachment[];
}

export interface EmailRecord extends RawEmail {
  id: string;
  runId: string;
  contentHash: string;
}

export type Category =
  | "hacienda"
  | "ccss"
  | "ins"
  | "bancos"
  | "proveedores"
  | "clientes"
  | "contador"
  | "ventas"
  | "ruido";

export type ItemKind =
  | "factura"
  | "aviso"
  | "cobro"
  | "solicitud"
  | "pago_recibido"
  | "cobro_pendiente"
  | "cierre_datafono"
  | "cierre_ventas"
  | "reserva"
  | "ruido";

export type ItemStatus = "pendiente" | "pagado" | "vencido" | "informativo";
export type HaciendaStatus = "aceptado" | "rechazado" | "sin_respuesta";
export type AmountSource = "xml" | "archivo" | "ia" | "heuristica";

/** Datos de una factura electrónica leídos del XML con código (ADR-0002). */
export interface InvoiceData {
  numericKey: string;
  docNumber: string;
  issuerName: string;
  issuerTaxId: string;
  receiverTaxId: string | null;
  issuedAt: string; // ISO
  saleCondition: "contado" | "credito";
  creditDays: number;
  dueDate: string | null; // YYYY-MM-DD
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  lines: { detail: string; quantity: number; unitPrice: number; total: number }[];
}

/** Reserva leída con código: del .ics de la plataforma o de las líneas del correo del cliente. */
export interface ReservationData {
  code: string | null;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  people: number;
  name: string;
  phone: string | null;
  notes: string | null;
  deposit: number | null;
  status: "confirmada" | "cancelada" | "por_confirmar";
  fromFile: boolean;
}

/** Cierre diario leído con código (CSV adjunto) o del texto del correo. */
export interface SettlementData {
  source: "datafono" | "facturacion";
  date: string; // YYYY-MM-DD
  card: number; // con tarjeta (datáfono: monto bruto)
  cash: number | null;
  sinpe: number | null;
  total: number;
  commission: number | null;
  deposit: number | null;
  transactions: number | null;
  invoices: number | null;
  batch: string | null;
  fromFile: boolean; // true = CSV adjunto (exacto); false = texto del correo
}

export interface HaciendaMessage {
  numericKey: string;
  status: "aceptado" | "rechazado";
  detail: string;
}

/** Lo que Pulso entiende de un correo. */
export interface Extraction {
  emailId: string;
  category: Category;
  kind: ItemKind;
  counterparty: string | null;
  counterpartyTaxId: string | null;
  amount: number | null;
  currency: string;
  dueDate: string | null; // YYYY-MM-DD
  status: ItemStatus;
  summary: string;
  invoice: InvoiceData | null;
  haciendaStatus: HaciendaStatus | null;
  haciendaDetail: string | null;
  amountSource: AmountSource | null;
  doubtfulFields: string[];
  requestedDocuments: string[];
  extractedBy: "codigo" | "claude" | "heuristica";
  settlement?: SettlementData | null;
  reservation?: ReservationData | null;
}

export type AlertType =
  | "duplicado"
  | "monto_inusual"
  | "cobro_sin_factura"
  | "rechazo_hacienda"
  | "vencido"
  | "cierre_descuadre";

export type Confidence = "alta" | "media" | "baja";

export type AlertStatus =
  | "abierta"
  | "descartada"
  | "confirmada"
  | "recuperada"
  | "normal_aprendido";

/** Resultado de una regla (función pura, ADR-0003). */
export interface AlertDraft {
  key: string; // estable: permite conservar el estado entre corridas
  type: AlertType;
  confidence: Confidence;
  reason: string;
  ruleApplied: string;
  emailIds: string[]; // documentos relacionados (el primero es el principal)
  amountAtRisk: number | null;
  counterparty: string | null;
  counterpartyTaxId: string | null;
  meta: Record<string, unknown>; // datos para la evidencia (ratio, historial, etc.)
}

export interface Alert extends AlertDraft {
  id: string;
  status: AlertStatus;
  explanation: string;
  learnedRuleId: string | null;
  firstSeenRunId: string;
  analyzedAt: string;
  notified: boolean;
}

export interface LearnedRule {
  id: string;
  alertType: Exclude<AlertType, "rechazo_hacienda">;
  counterpartyTaxId: string | null;
  counterparty: string | null;
  condition: { maxRatio?: number; amount?: number; emailId?: string; maxDiff?: number };
  reason: string;
  createdFrom: "panel" | "whatsapp";
  sourceAlertId: string;
  createdAt: string;
  active: boolean;
}

export type ActionKind = "correo_proveedor" | "cobro" | "recordatorio";
export type ActionStatus = "pendiente" | "aprobada" | "guardada_en_gmail" | "descartada";

export interface Action {
  id: string;
  alertId: string;
  kind: ActionKind;
  to: string | null;
  subject: string;
  draft: string;
  status: ActionStatus;
  approvedVia: "panel" | "whatsapp" | null;
  approvedAt: string | null;
  gmailDraftId: string | null;
  createdAt: string;
}

export interface WhatsAppMessage {
  id: string;
  direction: "saliente" | "entrante";
  kind: "alerta" | "resumen" | "respuesta" | "recordatorio" | "llamada";
  body: string;
  status: "enviado" | "simulado" | "fallido" | "recibido" | "tope_diario" | "sonando" | "atendida" | "perdida";
  alertId: string | null;
  createdAt: string;
}

/** Recordatorio que el dueño pide por WhatsApp ("acordame el viernes a las 9 que debo pagar la CCSS"). */
export interface Reminder {
  id: string;
  task: string; // "pagar la CCSS"
  detail: string | null; // lo que Pulso sabe de eso, leído del correo: "₡1 248 750, vence el 26/11/2026"
  dueAt: string; // ISO (UTC)
  status: "pendiente" | "hecho" | "borrado";
  emailId: string | null; // correo relacionado, si lo hay
  source: "whatsapp" | "panel";
  createdAt: string;
  firedAt: string | null;
}

export interface LogStep {
  step: string;
  detail: string;
  count: number | null;
}

export interface Run {
  id: string;
  source: Source;
  label: string;
  startedAt: string;
  finishedAt: string | null;
  steps: LogStep[];
  headline: string;
}

export interface Company {
  name: string;
  taxId: string;
  ownerWhatsapp: string | null;
  notifyLevel: "graves" | "todo";
}
