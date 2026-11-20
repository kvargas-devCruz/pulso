import { dismissAlert } from "@/lib/engine/pipeline";
import { handle, store } from "@/lib/api";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await dismissAlert(store(), (await ctx.params).id);
    return { ok: true };
  });
}
