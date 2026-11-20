// Interfaz de almacenamiento. Supabase es la fuente de verdad en producción (ADR-0001);
// el almacenamiento local (archivo JSON) permite correr la demo sin configurar nada.
import type { Action, Alert, Company, EmailRecord, Extraction, LearnedRule, Reminder, Run, WhatsAppMessage } from "../types";

export interface Store {
  kind: "local" | "supabase";
  getCompany(): Promise<Company>;
  saveCompany(c: Company): Promise<void>;

  listEmails(): Promise<EmailRecord[]>;
  /** Guarda solo los correos nuevos (idempotente por source + externalId) y los devuelve. */
  addEmails(emails: EmailRecord[]): Promise<EmailRecord[]>;

  listExtractions(): Promise<Extraction[]>;
  upsertExtractions(list: Extraction[]): Promise<void>;

  listAlerts(): Promise<Alert[]>;
  upsertAlerts(list: Alert[]): Promise<void>;

  listRules(): Promise<LearnedRule[]>;
  upsertRule(r: LearnedRule): Promise<void>;
  deleteRule(id: string): Promise<void>;

  listActions(): Promise<Action[]>;
  upsertAction(a: Action): Promise<void>;

  listMessages(): Promise<WhatsAppMessage[]>;
  /** Agrega o actualiza (por id) un mensaje; las llamadas cambian de estado. */
  addMessage(m: WhatsAppMessage): Promise<void>;

  listReminders(): Promise<Reminder[]>;
  upsertReminder(r: Reminder): Promise<void>;

  listRuns(): Promise<Run[]>;
  saveRun(r: Run): Promise<void>;

  /** Borra todo (para reiniciar la demo o cuando el dueño pide borrar sus datos). */
  reset(): Promise<void>;
}

export const DEFAULT_COMPANY: Company = {
  name: process.env.PULSO_COMPANY_NAME || "Restaurante La Fogata S.A.",
  taxId: process.env.PULSO_COMPANY_TAX_ID || "3101900100",
  ownerWhatsapp: process.env.OWNER_WHATSAPP_TO || null,
  notifyLevel: "graves",
};
