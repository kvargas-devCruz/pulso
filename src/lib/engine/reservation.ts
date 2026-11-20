// Reservas (restaurante). Los datos salen de código, como las facturas y los cierres:
// 1) el .ics que adjunta la plataforma de reservas (exacto: fecha, hora, personas, estado);
// 2) si no hay .ics, las líneas del correo de un cliente que escribe directo ("para 8 personas
//    el domingo 22/11 a las 12:30"): queda "por confirmar".
import type { EmailRecord, ReservationData } from "../types";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Despliega las líneas continuadas del .ics (RFC 5545) y devuelve propiedad → valor. */
function icsProps(text: string): Map<string, { params: string; value: string }> {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const props = new Map<string, { params: string; value: string }>();
  let inEvent = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { inEvent = true; continue; }
    if (line === "END:VEVENT") break;
    if (!inEvent) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const [name, ...params] = head.split(";");
    if (!props.has(name.toUpperCase())) props.set(name.toUpperCase(), { params: params.join(";"), value: line.slice(colon + 1) });
  }
  return props;
}

const unescapeIcs = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

function labeled(text: string, label: RegExp): string | null {
  const m = text.match(new RegExp(`(?:^|\\n)\\s*(?:${label.source})\\s*:\\s*(.+)`, "i"));
  const v = m?.[1].trim();
  return v && v !== "-" ? v : null;
}

const money = (v: string | null): number | null => {
  if (!v) return null;
  const n = Number(v.replace(/[₡\s.]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Lee el .ics de una reserva. Devuelve null si no es un evento de reserva válido. */
export function parseReservationIcs(text: string): ReservationData | null {
  if (!/BEGIN:VEVENT/.test(text)) return null;
  const p = icsProps(text);
  const start = p.get("DTSTART")?.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!start) return null;
  const desc = unescapeIcs(p.get("DESCRIPTION")?.value ?? "");
  const summary = unescapeIcs(p.get("SUMMARY")?.value ?? "");
  const people = Number(p.get("X-PARTY-SIZE")?.value ?? labeled(desc, /personas/)?.match(/\d+/)?.[0] ?? NaN);
  if (!Number.isFinite(people) || people <= 0) return null;
  const name = summary.replace(/^reserva\s+/i, "").replace(/\s*·.*$/, "").trim() || "Cliente";
  return {
    code: p.get("UID")?.value.split("@")[0] ?? null,
    date: `${start[1]}-${start[2]}-${start[3]}`,
    time: start[4] ? `${start[4]}:${start[5]}` : null,
    people,
    name,
    phone: labeled(desc, /tel[eé]fono/),
    notes: labeled(desc, /notas/),
    deposit: money(labeled(desc, /anticipo/)),
    status: /CANCELLED/i.test(p.get("STATUS")?.value ?? "") ? "cancelada" : "confirmada",
    fromFile: true,
  };
}

/** Pedido de reserva escrito por un cliente: fecha, hora y personas del texto. */
export function parseReservationText(subject: string, body: string, senderName: string): ReservationData | null {
  const all = `${subject}\n${body}`;
  if (!/reserv/.test(norm(all))) return null;
  const date = all.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const people = norm(all).match(/(?:para|mesa para)\s+(\d{1,3})\s+personas|(\d{1,3})\s+personas/);
  if (!date || !people) return null;
  const time = all.match(/a las\s+(\d{1,2})[:.](\d{2})|(\d{1,2}):(\d{2})/i);
  const deposit = norm(all).match(/(?:adelanto|anticipo)[^\d₡]{0,30}₡?\s*(\d[\d .]*(?:,\d{1,2})?)/);
  const hh = time ? (time[1] ?? time[3]) : null;
  const mm = time ? (time[2] ?? time[4]) : null;
  return {
    code: null,
    date: `${date[3]}-${date[2].padStart(2, "0")}-${date[1].padStart(2, "0")}`,
    time: hh ? `${hh.padStart(2, "0")}:${mm}` : null,
    people: Number(people[1] ?? people[2]),
    name: senderName,
    phone: null,
    notes: null,
    deposit: deposit ? money(deposit[1]) : null,
    status: /cancel/.test(norm(subject)) ? "cancelada" : "por_confirmar",
    fromFile: false,
  };
}

/** La reserva de un correo: primero el .ics adjunto; si no, el texto. */
export function reservationFromEmail(email: EmailRecord, senderName: string): ReservationData | null {
  for (const a of email.attachments) {
    if (!a.content) continue;
    if (a.type === "text/calendar" || a.name.toLowerCase().endsWith(".ics")) {
      const r = parseReservationIcs(a.content);
      if (r) return r;
    }
  }
  return parseReservationText(email.subject, email.body, senderName);
}
