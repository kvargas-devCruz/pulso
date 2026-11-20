// Celular de la demo: responder "1", "2" o "VER" desde el panel cuando no hay Twilio configurado.
import { handleReply } from "@/lib/engine/pipeline";
import { handle, store } from "@/lib/api";

export async function POST(req: Request) {
  return handle(async () => {
    const { body } = (await req.json()) as { body: string };
    return { reply: await handleReply(store(), body ?? "") };
  });
}
