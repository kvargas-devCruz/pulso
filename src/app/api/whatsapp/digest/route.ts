import { buildState } from "@/lib/state";
import { sendWeekDigest } from "@/lib/engine/pipeline";
import { handle, store, today } from "@/lib/api";

export async function POST() {
  return handle(async () => {
    const state = await buildState(store(), today());
    return sendWeekDigest(store(), state.week);
  });
}
