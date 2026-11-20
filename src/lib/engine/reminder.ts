// Recordatorios: "acordame el viernes a las 9 que debo pagar la CCSS".
// La fecha y la hora se leen con código (nunca con IA) en hora de Costa Rica (UTC-6, sin
// horario de verano). Función pura: texto + "ahora" → cuándo y qué recordar.

import type { Doc } from "./rules";
import { payState, payableDocs } from "./status";
import { colones, fecha } from "../format";

const CR_OFFSET_MS = 6 * 3600_000;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const TRIGGER = /\b(acordame|acuerdame|recordame|recuerdame|recordarme|acordarme|avisame|avisarme|haceme acordar|me recordas|me acordas)\b/;
const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const NUM_WORDS: Record<string, number> = { una: 1, un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, diez: 10, quince: 15, veinte: 20, treinta: 30 };

export interface ParsedReminder { dueAt: string; task: string; hasTime: boolean }

export const isReminderRequest = (text: string) => TRIGGER.test(norm(text));

/** "Ahora" en Costa Rica como campos UTC (para operar fechas locales sin librerías). */
const crNow = (nowMs: number) => new Date(nowMs - CR_OFFSET_MS);
/** Fecha y hora locales de Costa Rica → ISO UTC. */
const crToIso = (y: number, mo: number, d: number, h: number, mi: number) => new Date(Date.UTC(y, mo, d, h, mi) + CR_OFFSET_MS).toISOString();

/**
 * Lee un pedido de recordatorio. Devuelve null si no es un recordatorio o si no se entiende
 * cuándo (en ese caso Pulso pregunta en vez de inventar la fecha).
 */
export function parseReminder(text: string, nowMs: number): ParsedReminder | null {
  const q = norm(text);
  if (!TRIGGER.test(q)) return null;
  const now = crNow(nowMs);

  // "en 5 minutos" / "en 2 horas" / "en media hora"
  const rel = q.match(/\ben (\d+|una?|dos|tres|cuatro|cinco|diez|quince|veinte|treinta|media) (minutos?|min|horas?)\b/);
  let task = q;
  let dueAt: string | null = null;
  let hasTime = false;
  if (rel) {
    const n = rel[1] === "media" ? 0.5 : Number(rel[1]) || NUM_WORDS[rel[1]] || 1;
    const ms = /hora/.test(rel[2]) ? n * 3600_000 : n * 60_000;
    dueAt = new Date(nowMs + ms).toISOString();
    hasTime = true;
    task = task.replace(rel[0], " ");
  } else {
    // día
    let y = now.getUTCFullYear(), mo = now.getUTCMonth(), d = now.getUTCDate();
    let dayFound = false;
    const dm = q.match(/\b(?:el )?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
    const wd = WEEKDAYS.findIndex((w) => new RegExp(`\\b(?:el )?${w}\\b`).test(q));
    if (/\bpasado manana\b/.test(q)) { d += 2; dayFound = true; task = task.replace(/\bpasado manana\b/, " "); }
    else if (/(?<!la )\bmanana\b/.test(q)) {
      // "mañana" es el día; "de la mañana" es la hora
      d += 1; dayFound = true; task = task.replace(/(?<!la )\bmanana\b/, " ");
    }
    else if (/\bhoy\b/.test(q)) { dayFound = true; task = task.replace(/\bhoy\b/, " "); }
    else if (dm) {
      d = Number(dm[1]); mo = Number(dm[2]) - 1; if (dm[3]) y = Number(dm[3]);
      dayFound = true; task = task.replace(dm[0], " ");
    } else if (wd >= 0) {
      const diff = (wd - now.getUTCDay() + 7) % 7 || 7; // "el viernes" dicho un viernes = el próximo
      d += diff; dayFound = true; task = task.replace(new RegExp(`\\b(?:el )?${WEEKDAYS[wd]}\\b`), " ");
    }

    // hora: "a las 9", "a las 9:30", "9 am", "3 de la tarde", "al mediodia"
    let h = 9, mi = 0;
    const SUF = String.raw`(a\.? ?m\.?|p\.? ?m\.?|de la manana|de la tarde|de la noche)`;
    const explicit =
      q.match(new RegExp(String.raw`\ba las? (\d{1,2})(?::(\d{2}))?\s*${SUF}?`)) ?? // "a las 9", "a las 3 de la tarde"
      q.match(new RegExp(String.raw`\b(\d{1,2})(?::(\d{2}))?\s*${SUF}`)) ?? // "9 am", "3 de la tarde"
      q.match(/\b(\d{1,2}):(\d{2})()\b/); // "9:30"
    if (/\bal mediodia\b/.test(q)) { h = 12; hasTime = true; task = task.replace(/\bal mediodia\b/, " "); }
    else if (explicit) {
      h = Number(explicit[1]); mi = Number(explicit[2] ?? 0);
      const suf = explicit[3] ?? "";
      if (/p\.? ?m|tarde|noche/.test(suf) && h < 12) h += 12;
      if (/a\.? ?m|manana/.test(suf) && h === 12) h = 0;
      if (!suf && h >= 1 && h <= 6) h += 12; // "a las 3" en un negocio = 3 p. m.
      hasTime = true;
      task = task.replace(explicit[0], " ");
    }
    if (h > 23 || mi > 59) return null;
    if (!dayFound && !hasTime) return null; // no se sabe cuándo: mejor preguntar
    let iso = crToIso(y, mo, d, h, mi);
    if (!dayFound && Date.parse(iso) <= nowMs) iso = crToIso(y, mo, d + 1, h, mi); // "a las 9" y ya pasó → mañana
    dueAt = iso;
  }

  task = task
    .replace(TRIGGER, " ")
    .replace(/\b(por favor|porfa|pulso)\b/g, " ")
    .replace(/^[\s,]*(que|de|para|a)\s+(tengo que |debo |hay que )?/, "")
    .replace(/\s+(que|de|para)\s+(tengo que |debo |hay que )/, " ")
    .replace(/^(tengo que|debo|hay que)\s+/, "")
    .replace(/[¿?¡!.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { dueAt: dueAt!, task: originalWords(text, task) || "lo que me pediste", hasTime };
}

/** Recupera la tarea con las mayúsculas y tildes que escribió el dueño ("pagar la CCSS"). */
function originalWords(text: string, normalizedTask: string): string {
  const want = normalizedTask.split(" ").filter(Boolean);
  if (!want.length) return "";
  const words = text.split(/\s+/).map((w) => ({ raw: w.replace(/^[¿¡"'(]+|[?!.,;:"')]+$/g, ""), n: norm(w).replace(/[¿?¡!.,;:"'()]/g, "") }));
  for (let i = 0; i + want.length <= words.length; i++) {
    if (want.every((w, k) => words[i + k].n === w)) return words.slice(i, i + want.length).map((w) => w.raw).join(" ");
  }
  return normalizedTask;
}

/** "viernes 27/11 a las 9:00" en hora de Costa Rica. */
export function formatDue(iso: string, nowMs: number): string {
  const t = new Date(Date.parse(iso) - CR_OFFSET_MS);
  const n = crNow(nowMs);
  const sameDay = (a: Date, b: Date) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
  const tomorrow = new Date(n.getTime() + 86_400_000);
  const day = sameDay(t, n) ? "hoy" : sameDay(t, tomorrow) ? "mañana" : `el ${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][t.getUTCDay()]} ${String(t.getUTCDate()).padStart(2, "0")}/${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${day} a las ${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
}

const STOP = new Set(["pagar", "pago", "debo", "tengo", "que", "la", "el", "los", "las", "de", "del", "a", "al", "con", "por", "para", "una", "un", "y", "s", "sa", "cr", "vence", "llamar", "revisar", "confirmar", "reserva"]);

/**
 * Lo que Pulso ya sabe de la tarea, leído del correo: "pagar la CCSS" → la factura pendiente de
 * la CCSS (monto y vencimiento); "confirmar la reserva de Datacorp" → esa reserva. Sin coincidencia, null.
 */
export function relatedFor(task: string, docs: Doc[], today: string): { emailId: string; detail: string; dueDate: string | null } | null {
  const words = norm(task).split(" ").filter((w) => w.length >= 3 && !STOP.has(w));
  if (!words.length) return null;
  const score = (name: string | null) => {
    const n = norm(name ?? "").split(" ");
    return words.filter((w) => n.some((x) => x === w || (w.length >= 5 && x.startsWith(w.slice(0, 5))))).length;
  };
  const candidates: { d: Doc; detail: string; s: number }[] = [];
  for (const d of payableDocs(docs).filter((x) => payState(x, today) !== "pagado"))
    candidates.push({ d, s: score(d.ext.counterparty), detail: `${colones(d.ext.amount)}${d.ext.dueDate ? `, vence el ${fecha(d.ext.dueDate)}` : ""}` });
  for (const d of docs.filter((x) => x.ext.reservation && x.ext.reservation.status !== "cancelada")) {
    const r = d.ext.reservation!;
    candidates.push({ d, s: score(r.name), detail: `reserva de ${r.people} personas el ${fecha(r.date)}${r.time ? ` a las ${r.time}` : ""}` });
  }
  for (const d of docs.filter((x) => x.ext.kind === "cobro_pendiente" && x.ext.status !== "pagado"))
    candidates.push({ d, s: score(d.ext.counterparty), detail: `te debe ${colones(d.ext.amount)}` });
  const best = candidates.filter((c) => c.s > 0).sort((a, b) => b.s - a.s)[0];
  return best ? { emailId: best.d.email.id, detail: best.detail, dueDate: best.d.ext.reservation ? null : best.d.ext.dueDate } : null;
}

/** Texto de la llamada, para leer en voz alta. */
export function callScript(task: string, detail: string | null): string {
  return `Hola, te habla Pulso. Te llamo para recordarte: ${task}${detail ? `: ${detail}` : ""}. Que tengás buen día.`;
}
