import { approveAlert } from "@/lib/engine/pipeline";
import { handle, store } from "@/lib/api";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => approveAlert(store(), (await ctx.params).id, "panel"));
}
