// Llamada de recordatorio (simulada en el panel): el dueño contesta o rechaza.
import { handle, store } from "@/lib/api";
import { answerCall } from "@/lib/engine/pipeline";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const { outcome } = (await req.json().catch(() => ({}))) as { outcome?: string };
    await answerCall(store(), id, outcome === "perdida" ? "perdida" : "atendida");
    return { ok: true };
  });
}
