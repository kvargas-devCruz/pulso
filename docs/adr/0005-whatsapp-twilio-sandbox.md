# ADR-0005: WhatsApp con Twilio Sandbox en el prototipo

**Estado:** aceptada · 19/11/2026

## Contexto
Los dueños de pymes viven en WhatsApp. Se necesita enviar alertas y recibir respuestas ("1", "2", "VER") en un fin de semana, sin esperar aprobaciones de Meta.

## Decisión
- Prototipo: **Twilio WhatsApp Sandbox**. El celular del dueño se une al sandbox con un código. Envío desde `lib/notify/whatsapp.ts`; respuestas en `api/whatsapp/webhook` (validando la firma de Twilio).
- Respuestas soportadas: `1` aprueba la acción de la última alerta → borrador en Gmail · `2` la marca como normal → regla aprendida · `VER` envía el link al detalle.
- Los mensajes llevan resumen + monto + confianza + link. Nunca el XML ni datos completos.
- Agrupación de alertas y tope diario para no hacer spam.
- Producción: WhatsApp Business Cloud API de Meta con plantillas aprobadas.

## Consecuencias
- (+) WhatsApp de ida y vuelta funcionando en horas.
- (−) El sandbox solo llega a números unidos y su remitente es de Twilio; se explica en el pitch como limitación del prototipo.
