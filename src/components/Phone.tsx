"use client";
import { useEffect, useRef, useState } from "react";
import type { WhatsAppMessage } from "@/lib/types";

function Bold({ text }: { text: string }) {
  // *negrita* al estilo WhatsApp
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("*") && p.endsWith("*") ? <strong key={i}>{p.slice(1, -1)}</strong> : <span key={i}>{p}</span>))}</>;
}

/** "₡1 248 750" → "1248750 colones" para que la voz lo lea bien. */
const speakable = (t: string) =>
  t.replace(/₡\s?(\d[\d ]*)(,\d+)?/g, (_m, n: string) => `${n.replace(/ /g, "")} colones`).replace(/(\d{2})\/(\d{2})\/(\d{4})/g, "$1 del $2");

function speak(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  const voices = window.speechSynthesis.getVoices();
  u.voice = voices.find((v) => v.lang === "es-CR") ?? voices.find((v) => v.lang.startsWith("es-") && /latin|mx|us|419/i.test(v.lang + v.name)) ?? voices.find((v) => v.lang.startsWith("es")) ?? null;
  u.lang = u.voice?.lang ?? "es-MX";
  u.rate = 0.98;
  u.onend = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function Phone({ messages, real, busy, onSend, ringing, onCall }: {
  messages: WhatsAppMessage[];
  real: boolean;
  busy: boolean;
  onSend: (body: string) => void;
  ringing?: WhatsAppMessage | null;
  onCall?: (callId: string, outcome: "atendida" | "perdida") => void;
}) {
  const [text, setText] = useState("");
  const [onCallMsg, setOnCallMsg] = useState<WhatsAppMessage | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);
  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);

  const send = (body: string) => {
    if (!body.trim() || busy) return;
    onSend(body.trim());
    setText("");
  };
  const answer = (call: WhatsAppMessage) => {
    setOnCallMsg(call);
    onCall?.(call.id, "atendida");
    speak(call.body);
  };
  const hangUp = () => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setOnCallMsg(null);
  };

  const incoming = ringing && (!onCallMsg || onCallMsg.id !== ringing.id) ? ringing : null;

  return (
    <section aria-label="WhatsApp del dueño" className="relative overflow-hidden rounded-[28px] border-[6px] border-ink bg-wa-bg shadow-sm">
      <div className="flex items-center gap-3 bg-wa px-4 py-3 text-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-bold">P</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">Pulso</div>
          <div className="text-xs text-white/75">{real ? "WhatsApp real · Twilio" : "Vista previa · WhatsApp simulado"}</div>
        </div>
      </div>
      <div ref={scroller} className="h-[360px] space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="mx-auto mt-10 max-w-[240px] rounded-lg bg-white/80 p-3 text-center text-xs text-stone-600">
            Aquí te llegan las señales de Pulso cuando algo no cuadra. Respondé 1, 2 o VER, o pedile: “acordame mañana a las 9 que debo pagar la CCSS”.
          </p>
        )}
        {messages.map((m) => {
          if (m.kind === "llamada") {
            const label = m.status === "atendida" ? "Llamada de Pulso · contestada" : m.status === "perdida" ? "Llamada perdida de Pulso" : "Pulso te está llamando…";
            return (
              <div key={m.id} className="flex justify-center">
                <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-[12px] shadow-sm ${m.status === "perdida" ? "bg-red-soft text-red" : "bg-white text-stone-600"}`}>
                  <span aria-hidden>{m.status === "perdida" ? "📵" : "📞"}</span>{label}
                  <span className="text-[10px] text-stone-400">{new Date(m.createdAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            );
          }
          const mine = m.direction === "entrante"; // lo que escribe el dueño
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-snug shadow-sm ${mine ? "bg-wa-bubble" : "bg-white"}`}>
                <Bold text={m.body} />
                <div className="mt-1 text-right text-[10px] text-stone-500">
                  {new Date(m.createdAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}
                  {m.status === "simulado" ? " · simulado" : m.status === "fallido" ? " · no se envió" : m.status === "tope_diario" ? " · tope diario: no se envió" : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-2 bg-[#f0f0f0] p-2">
        <div className="flex gap-2">
          {["1", "2", "VER"].map((q) => (
            <button key={q} disabled={busy} onClick={() => send(q)} className="flex-1 rounded-full bg-white py-1.5 text-sm font-semibold text-wa shadow-sm hover:bg-stone-50 disabled:opacity-50">
              {q}
            </button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <label className="sr-only" htmlFor="wa-input">Responder a Pulso</label>
          <input id="wa-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={real ? "Respondé desde tu celular o aquí" : "Escribí una respuesta"} className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-sm outline-none ring-wa focus:ring-2" />
          <button type="submit" disabled={busy} className="rounded-full bg-wa px-4 text-sm font-semibold text-white disabled:opacity-50">Enviar</button>
        </form>
      </div>

      {/* Llamada entrante (simulada): Pulso llama para el recordatorio */}
      {incoming && (
        <div role="dialog" aria-label="Llamada entrante de Pulso" className="absolute inset-0 z-10 flex flex-col items-center justify-between bg-gradient-to-b from-[#0b3d36] to-[#075e54] px-6 py-10 text-white">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-white/70">Llamada de voz</div>
            <span className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/15 text-3xl font-bold ring-8 ring-white/10 [animation:pulso-beat_1.6s_ease-in-out_infinite]">P</span>
            <div className="mt-4 text-xl font-semibold">Pulso</div>
            <div className="text-sm text-white/80">te está llamando…</div>
            <p className="mt-4 text-xs text-white/70">Recordatorio que pediste por WhatsApp</p>
          </div>
          <div className="flex w-full justify-around">
            <button onClick={() => { onCall?.(incoming.id, "perdida"); }} className="flex flex-col items-center gap-1 text-xs" aria-label="Rechazar">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e5484d] text-2xl shadow-lg" aria-hidden>✕</span>Rechazar
            </button>
            <button onClick={() => answer(incoming)} className="flex flex-col items-center gap-1 text-xs" aria-label="Contestar">
              <span className="flex h-14 w-14 animate-bounce items-center justify-center rounded-full bg-[#25d366] text-2xl shadow-lg" aria-hidden>📞</span>Contestar
            </button>
          </div>
        </div>
      )}

      {/* En llamada: se escucha y se lee el recordatorio */}
      {onCallMsg && (
        <div role="dialog" aria-label="En llamada con Pulso" className="absolute inset-0 z-10 flex flex-col items-center justify-between bg-gradient-to-b from-[#0b3d36] to-[#075e54] px-6 py-10 text-white">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-white/70">En llamada · Pulso</div>
            <span className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-2xl font-bold" aria-hidden>🔊</span>
            <p className="mt-5 text-[15px] leading-relaxed">{onCallMsg.body}</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => speak(onCallMsg.body)} className="rounded-full bg-white/15 px-4 py-2 text-sm">Repetir</button>
            <button onClick={hangUp} className="flex items-center gap-2 rounded-full bg-[#e5484d] px-5 py-2 text-sm font-semibold" aria-label="Colgar">✕ Colgar</button>
          </div>
        </div>
      )}
    </section>
  );
}
