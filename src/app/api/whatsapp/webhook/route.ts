// Webhook de Twilio (ADR-0005): respuestas "1", "2" o "VER" del dueño.
import { handleReply } from "@/lib/engine/pipeline";
import { validTwilioRequest } from "@/lib/notify/whatsapp";
import { store } from "@/lib/api";

export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => { params[k] = String(v); });
  const url = process.env.APP_URL ? `${process.env.APP_URL}/api/whatsapp/webhook` : req.url;
  if (!validTwilioRequest(req.headers.get("x-twilio-signature"), url, params))
    return new Response("Firma inválida", { status: 403 });
  // Solo se acepta el número del dueño.
  const owner = process.env.OWNER_WHATSAPP_TO;
  if (owner && params.From && params.From !== owner) return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
  await handleReply(store(), params.Body ?? "");
  // La respuesta ya se envió por la API de Twilio dentro de handleReply; devolvemos TwiML vacío.
  return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
}
