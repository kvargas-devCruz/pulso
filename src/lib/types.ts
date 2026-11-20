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
  | "ruido";

export type ItemKind =
  | "factura"
  | "aviso"
  | "cobro"
  | "solicitud"
  | "pago_recibido"
  | "cobro_pendiente"
  | "ruido";

export type ItemStatus = "pendiente" | "pagado" | "vencido" | "informativo";
export type HaciendaStatus = "aceptado" | "rechazado" | "sin_respuesta";
export type AmountSource = "xml" | "ia" | "heuristica";

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
}

export type AlertType =
  | "duplicado"
  | "monto_inusual"
  | "cobro_sin_factura"
  | "rechazo_hacienda"
  | "vencido";

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
  condition: { maxRatio?: number; amount?: number; emailId?: string };
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
  kind: "alerta" | "resumen" | "respuesta";
  body: string;
  status: "enviado" | "simulado" | "fallido" | "recibido";
  alertId: string | null;
  createdAt: string;
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
