import { demoAdapter, gmailAdapter, DEMO_LOTES, type DemoLote } from "@/lib/ingest";
import { runIngest } from "@/lib/engine/pipeline";
import { handle, store, today } from "@/lib/api";

// Lote 1 hace varios viajes a Supabase (y a Claude cuando está activo).
export const maxDuration = 60;

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as { source?: string; lote?: string };
    if (body.source === "gmail") return runIngest(store(), gmailAdapter(), today());
    const lote = (DEMO_LOTES as readonly string[]).includes(body.lote ?? "") ? (body.lote as DemoLote) : "lote-1";
    const res = await runIngest(store(), demoAdapter(lote), today());
    return { run: res.run, newEmails: res.newEmails, newAlerts: res.newAlerts.length, notified: !!res.notified };
  });
}
