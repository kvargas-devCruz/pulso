import { connection } from "next/server";
import { buildState } from "@/lib/state";
import { handle, store, today } from "@/lib/api";

export async function GET() {
  await connection(); // siempre en tiempo de petición: el estado cambia con cada correo
  return handle(() => buildState(store(), today()));
}
