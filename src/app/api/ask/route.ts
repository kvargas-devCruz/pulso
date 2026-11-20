// "Preguntale a Pulso" (R21): respuesta calculada con código, con los correos de respaldo.
import { ask } from "@/lib/engine/pipeline";
import { handle, store, today } from "@/lib/api";

export async function POST(req: Request) {
  return handle(async () => {
    const { q } = (await req.json().catch(() => ({}))) as { q?: string };
    const question = (q ?? "").trim().slice(0, 300);
    if (!question) throw new Error("Escribí una pregunta.");
    return ask(store(), question, today());
  });
}
