"use client";
import { useEffect, useRef, useState } from "react";
import type { WhatsAppMessage } from "@/lib/types";

function Bold({ text }: { text: string }) {
  // *negrita* al estilo WhatsApp
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("*") && p.endsWith("*") ? <strong key={i}>{p.slice(1, -1)}</strong> : <span key={i}>{p}</span>))}</>;
}

export function Phone({ messages, real, busy, onSend }: { messages: WhatsAppMessage[]; real: boolean; busy: boolean; onSend: (body: string) => void }) {
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = (body: string) => {
    if (!body.trim() || busy) return;
    onSend(body.trim());
    setText("");
  };

  return (
    <section aria-label="WhatsApp del dueño" className="overflow-hidden rounded-[28px] border-[6px] border-ink bg-wa-bg shadow-sm">
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
            Aquí te llegan las señales de Pulso cuando algo no cuadra. Respondé 1, 2 o VER.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.direction === "entrante"; // lo que escribe el dueño
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-snug shadow-sm ${mine ? "bg-wa-bubble" : "bg-white"}`}>
                <Bold text={m.body} />
                <div className="mt-1 text-right text-[10px] text-stone-500">
                  {new Date(m.createdAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}
                  {m.status === "simulado" ? " · simulado" : m.status === "fallido" ? " · no se envió" : ""}
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
    </section>
  );
}
