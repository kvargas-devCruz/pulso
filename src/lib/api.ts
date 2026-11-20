// Ayudas para las rutas API.
import { getStore } from "./store";
import { todayCR } from "./format";

export const store = () => getStore();
export const today = () => todayCR();

export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Algo salió mal.";
    console.error("[pulso]", err);
    return Response.json({ error: message }, { status: 400 });
  }
}
