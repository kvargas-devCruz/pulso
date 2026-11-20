// Recordatorios desde el panel: "probar" (suena ya, para la demo) o "borrar".
import { handle, store } from "@/lib/api";
import { fireDueReminders } from "@/lib/engine/pipeline";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const { action } = (await req.json().catch(() => ({}))) as { action?: "probar" | "borrar" };
    const s = store();
    const r = (await s.listReminders()).find((x) => x.id === id);
    if (!r) throw new Error("No encontré ese recordatorio.");
    if (action === "borrar") {
      await s.upsertReminder({ ...r, status: "borrado" });
      return { ok: true };
    }
    await s.upsertReminder({ ...r, status: "pendiente", dueAt: new Date(Date.now() - 1000).toISOString() });
    await fireDueReminders(s, Date.now());
    return { ok: true };
  });
}
