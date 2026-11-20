import { deleteRule } from "@/lib/engine/pipeline";
import { handle, store } from "@/lib/api";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    await deleteRule(store(), id);
    return { ok: true };
  });
}
