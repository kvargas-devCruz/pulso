"use client";
// El agente a la vista: (1) la bitácora animada mientras Pulso procesa correos y
// (2) "Preguntale a Pulso" con preguntas sugeridas y los correos que respaldan la respuesta.
import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Card, PulseIcon, colones } from "./ui";

// ---------------------------------------------------------------- bitácora animada
export interface LiveStep { step: string; detail: string }
export interface LiveAlert { id: string; title: string; counterparty: string | null; amount: number | null; confidence: string }
export interface LiveRunState {
  label: string;
  steps: LiveStep[] | null; // null = todavía procesando
  alerts: LiveAlert[];
  headline: string | null;
  notified?: boolean;
  /** Ya terminó de animarse: al volver a Inicio se muestra completo, sin repetir. */
  done?: boolean;
}

const STEP_LABEL: Record<string, string> = {
  leer: "Leyendo tu correo",
  extraer: "Leyendo facturas (XML) y cierres",
  hacienda: "Revisando las respuestas de Hacienda",
  clasificar: "Ordenando por tipo",
  reglas: "Buscando lo que no cuadra",
  aprendido: "Aplicando lo que me enseñaste",
  notificar: "Avisándote por WhatsApp",
};
const EXPECTED = ["leer", "extraer", "hacienda", "clasificar", "reglas"];
const STEP_MS = 420;

function Check() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green text-white" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </span>
  );
}
function Spinner() {
  return <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent" aria-hidden />;
}
function Pending() {
  return <span className="h-5 w-5 shrink-0 rounded-full border-2 border-line" aria-hidden />;
}

export function LiveRun({ run, onClose, onOpenAlert, onOpenWhatsApp }: { run: LiveRunState; onClose: () => void; onOpenAlert: (id: string) => void; onOpenWhatsApp?: () => void }) {
  // Pasos reales del pipeline, revelados uno por uno cuando llega la respuesta.
  const total = run.steps?.length ?? 0;
  const [shown, setShown] = useState(run.done ? total : 0);
  useEffect(() => {
    if (!run.steps || shown >= total) return;
    const t = setTimeout(() => setShown((n) => n + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [run.steps, shown, total]);

  const done = !!run.steps && shown >= total;
  const rows: { key: string; state: "done" | "doing" | "todo"; detail: string | null }[] = run.steps
    ? run.steps.map((s, i) => ({ key: s.step, state: i < shown ? "done" : i === shown ? "doing" : "todo", detail: i < shown ? s.detail : null }))
    : EXPECTED.map((k, i) => ({ key: k, state: i === 0 ? "doing" : "todo", detail: null }));

  return (
    <Card className="border-2 border-accent/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PulseIcon className={`h-5 w-5 text-accent ${done ? "" : "beat"}`} />
          <h2 className="text-sm font-semibold">{done ? "Listo" : "Pulso está trabajando…"} <span className="font-normal text-muted">· {run.label}</span></h2>
        </div>
        {done && <Button variant="ghost" onClick={onClose}>Cerrar</Button>}
      </div>
      <ol className="space-y-2" aria-live="polite">
        {rows.map((r) => (
          <li key={r.key} className={`flex items-start gap-3 text-sm transition-opacity ${r.state === "todo" ? "opacity-45" : ""}`}>
            {r.state === "done" ? <Check /> : r.state === "doing" ? <Spinner /> : <Pending />}
            <div className="min-w-0">
              <div className="font-medium">{STEP_LABEL[r.key] ?? r.key}</div>
              {r.detail && <div className="text-xs text-muted">{r.detail}</div>}
            </div>
          </li>
        ))}
      </ol>
      {done && run.alerts.length > 0 && (
        <div className="mt-4 space-y-2">
          {[...run.alerts].sort((x, y) => (y.amount ?? 0) - (x.amount ?? 0)).slice(0, 3).map((a) => (
            <button key={a.id} onClick={() => onOpenAlert(a.id)} className="flex w-full items-center gap-3 rounded-xl bg-red-soft px-3 py-2 text-left text-sm transition hover:brightness-95">
              <span aria-hidden>⚠️</span>
              <span className="min-w-0 flex-1"><strong>{a.title}</strong> · {a.counterparty}</span>
              {a.amount ? <span className="tabular font-semibold">{colones(a.amount)}</span> : null}
              <span className="text-xs text-muted">ver evidencia →</span>
            </button>
          ))}
          {run.alerts.length > 3 && <p className="px-1 text-xs text-muted">y {run.alerts.length - 3} más en «Lo que no cuadra».</p>}
        </div>
      )}
      {done && run.notified && onOpenWhatsApp && (
        <button onClick={onOpenWhatsApp} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-[#e7f8ee] px-3 py-2 text-left text-sm text-[#075e54] transition hover:brightness-95">
          <span aria-hidden>📱</span><span className="flex-1">Te avisé por WhatsApp</span><span className="text-xs">ver el mensaje →</span>
        </button>
      )}
      {done && run.alerts.length === 0 && <p className="mt-4 rounded-xl bg-green-soft px-3 py-2 text-sm text-green">Nada nuevo que no cuadre. ✅</p>}
    </Card>
  );
}

// ---------------------------------------------------------------- Preguntale a Pulso
interface AskResult { intent: string; answer: string; title?: string; sources: { emailId: string; label: string; counterparty: string | null }[]; links?: { label: string; url: string }[]; disclaimer?: string }

export function AskPulso({ suggestions, onOpenEmail, compact = false }: { suggestions: string[]; onOpenEmail: (id: string) => void; compact?: boolean }) {
  const [more, setMore] = useState(false);
  const shown = compact && !more ? suggestions.slice(0, 4) : suggestions;
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ q: string; r: AskResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: text }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No pude responder.");
      setResult({ q: text, r: data });
      setQ("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude responder.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4zM8 9h8M8 12h5" /></svg>
        </span>
        <div>
          <h2 className="text-sm font-semibold">Preguntale a Pulso</h2>
          <p className="text-xs text-muted">{compact ? "Tu correo, tu WhatsApp y normas básicas, con la fuente." : "Te respondo con lo que llegó a tu correo y con las normas laborales y fiscales básicas, y te muestro de dónde lo saqué."}</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ej.: ¿Reservas del sábado? · ¿Cuánto le debo a la Cervecería?"
          aria-label="Tu pregunta"
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg/60 px-3 py-2 text-sm outline-none transition focus:border-accent focus:bg-surface"
        />
        <Button type="submit" variant="primary" disabled={busy || !q.trim()}>{busy ? "Pensando…" : "Preguntar"}</Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {shown.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => ask(s)}
            className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink transition hover:border-accent/40 hover:bg-accent-soft disabled:opacity-50"
          >
            {s}
          </button>
        ))}
        {compact && suggestions.length > 4 && (
          <button type="button" onClick={() => setMore((v) => !v)} className="rounded-full px-2 py-1 text-xs text-muted hover:text-ink">
            {more ? "menos" : `+${suggestions.length - 4} más`}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red">{error}</p>}
      {result && (
        <div className="mt-4 space-y-2" aria-live="polite">
          <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-sm text-white">{result.q}</div>
          <div className="w-fit max-w-[95%] rounded-2xl rounded-bl-md bg-bg px-3 py-2 text-sm">
            {result.r.title && <p className="mb-1 font-semibold">📚 {result.r.title}</p>}
            <p className="whitespace-pre-line">{result.r.answer}</p>
            {result.r.links && result.r.links.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-line pt-2 text-xs">
                <span className="text-muted">Fuente:</span>
                {result.r.links.map((l) => (
                  <a key={l.url + l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="block text-accent underline-offset-2 hover:underline">{l.label} ↗</a>
                ))}
                {result.r.disclaimer && <p className="pt-1 text-[11px] text-muted">ℹ️ {result.r.disclaimer}</p>}
              </div>
            )}
            {result.r.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
                <span className="text-xs text-muted">Fuente:</span>
                {result.r.sources.slice(0, 6).map((s) => (
                  <button key={s.emailId} onClick={() => onOpenEmail(s.emailId)} className="inline-flex items-center gap-1.5 rounded-full bg-surface py-0.5 pl-0.5 pr-2.5 text-xs shadow-sm transition hover:bg-accent-soft">
                    <Avatar name={s.counterparty ?? s.label} size={18} />
                    {s.label}
                  </button>
                ))}
                {result.r.sources.length > 6 && <span className="text-xs text-muted">y {result.r.sources.length - 6} más</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
