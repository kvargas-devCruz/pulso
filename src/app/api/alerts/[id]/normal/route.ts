import { markNormal } from "@/lib/engine/pipeline";
import { handle, store } from "@/lib/api";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
    return markNormal(store(), (await ctx.params).id, "panel", reason ?? "");
  });
}
