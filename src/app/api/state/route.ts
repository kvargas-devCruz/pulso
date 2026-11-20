import { connection } from "next/server";
import { buildState } from "@/lib/state";
import { fireDueReminders } from "@/lib/engine/pipeline";
import { handle, store, today } from "@/lib/api";

export async function GET() {
  await connection(); // siempre en tiempo de petición: el estado cambia con cada correo
  return handle(async () => {
    // Los recordatorios vencidos se disparan aquí (el panel pide el estado cada 5 s).
    await fireDueReminders(store(), Date.now());
    return buildState(store(), today());
  });
}
