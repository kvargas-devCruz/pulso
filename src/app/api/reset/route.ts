import { handle, store } from "@/lib/api";

export async function POST() {
  return handle(async () => {
    await store().reset();
    return { ok: true };
  });
}
