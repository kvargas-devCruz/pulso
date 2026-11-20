// Envío por WhatsApp con Twilio (ADR-0005). Sin credenciales, el mensaje queda "simulado"
// y se ve en el celular de la demo dentro del panel.
import twilio from "twilio";

export function whatsappConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM && process.env.OWNER_WHATSAPP_TO);
}

export async function sendWhatsApp(body: string): Promise<{ status: "enviado" | "simulado" | "fallido"; sid?: string; error?: string }> {
  if (!whatsappConfigured()) return { status: "simulado" };
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    const msg = await client.messages.create({ from: process.env.TWILIO_WHATSAPP_FROM!, to: process.env.OWNER_WHATSAPP_TO!, body: body.slice(0, 1500) });
    return { status: "enviado", sid: msg.sid };
  } catch (err) {
    return { status: "fallido", error: err instanceof Error ? err.message : String(err) };
  }
}

/** Valida que la petición al webhook viene de Twilio. Si no hay token (modo demo), se acepta. */
export function validTwilioRequest(signature: string | null, url: string, params: Record<string, string>): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true;
  if (!signature) return false;
  return twilio.validateRequest(token, signature, url, params);
}
