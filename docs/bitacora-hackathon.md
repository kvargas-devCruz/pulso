# Bitácora del hackathon

Lo que se hizo cada día, para el README y para demostrar el progreso durante el evento.

## Punto de partida (jueves 19/11/2026)
Antes del inicio del hackathon el repo tenía **solo documentación y datos de prueba**, sin código de la app:
- `PRD.md`, `CLAUDE.md`, `docs/adr/` (7 decisiones) y `docs/PLAYBOOK.md`
- `supabase/migrations/0001_init.sql` (esquema)
- `scripts/generar_bandeja.py` y `data/bandeja-prueba/` (38 correos ficticios + respuesta esperada)

[ ] Captura de pantalla del repo en este punto

## Viernes 20/11
**Qué se construyó (con Claude, en bloques verificados):**
- Proyecto Next.js 16 + TypeScript + Tailwind.
- Motor: lector de FacturaElectronica y MensajeHacienda (código), extracción con Claude (zod) y heurística de respaldo, clasificación, reglas puras con confianza (duplicado exacto/probable, monto inusual, cobro sin factura, rechazo de Hacienda, vencidos), reglas aprendidas, semáforo, "Tu semana", bitácora del agente.
- Store con dos implementaciones: Supabase (producción) y archivo local (demo sin configurar nada). Se simplificó el esquema: cada tabla tiene columnas para consultar y el objeto completo en `data` (jsonb).
- WhatsApp con Twilio (envío + webhook con validación de firma) y un celular simulado en el panel cuando no hay credenciales.
- Panel: semáforo, alertas con evidencia lado a lado, borradores, WhatsApp, Tu semana, reglas aprendidas, documentos con estado en Hacienda.
- `npm test` (10 pruebas) y `npm run eval`.

**Resultado de `npm run eval` (sin Claude):** extracción 100 % en la bandeja de prueba · 8/8 alertas plantadas · 0 falsos positivos · aprendizaje OK. (La heurística se escribió conociendo la bandeja; la precisión real se mide con Claude y correos reales.)

**Verificación visual:** el agente corrió el flujo de la demo en un navegador sin interfaz y revisó capturas. Encontró y corrigió: desborde horizontal en el celular, orden de las alertas (ahora por prioridad) y un doble punto en el texto del rechazo de Hacienda.

**Qué decidí yo y qué hizo el agente:** [ ] completar

**Deploy (viernes en la tarde):**
- Supabase real: la migración se aplicó desde el SQL Editor. Dos ajustes: el editor no acepta bloques `DO $$` (las políticas RLS quedaron escritas una por una) y los proyectos nuevos de Supabase no dan permisos a la Data API (se agregaron `grant` para `service_role` y `authenticated`).
- `npm run eval:supabase`: el mismo eval contra Postgres real → **8/8 alertas · 0 falsos positivos · extracción 100 %**, igual que con el archivo local. `SupabaseStore` funcionó sin cambios de lógica.
- Producción en Vercel: https://pulso-mu-nine.vercel.app. Flujo principal probado dos veces seguidas contra producción (lote 1 → enseñar → lote 2 → posible duplicado → WhatsApp → "1" → acción aprobada vía whatsapp en Supabase) y revisión visual en escritorio y celular.

**Cierres del datáfono y de caja (viernes en la noche):**
- Pulso lee el cierre de lote del datáfono (banco) y el cierre de caja del software de facturación desde su CSV adjunto, con código (si no hay CSV, de las líneas rotuladas del correo, con confianza media).
- Regla nueva `cierre_descuadre`: las ventas con tarjeta del cierre de caja tienen que coincidir con lo que cobró el datáfono ese día (tolerancia ₡1 000 o 0,5 %). El borrador va al banco si faltan colones, o es un recordatorio interno si el datáfono cobró de más.
- Vista Plata: ventas por día y por medio de pago; indicador "Ventas de la semana" en Inicio.
- Bandeja de prueba: 12 cierres nuevos (6 días, uno con ₡45 000 de diferencia). `npm run eval` → **9/9 alertas · 0 falsos positivos · extracción 100 % (48 correos)**. `npm test`: 20 pruebas.
- Formato de los cierres: ficticio. Falta validarlo con un cierre real del datáfono y del software que use el restaurante.

**Análisis de la competencia y mejoras de interfaz (viernes en la noche):**
- Se revisaron Alegra (CR; lanzó "Alegra Bot" en acceso anticipado), QuickBooks (Business Feed de agentes), Xero (JAX), Digits, Ramp (cuentas por pagar con IA) y Bolo/Zumma (WhatsApp en LatAm). Diferenciador de Pulso: lee todo el correo, con cualquier sistema, y vigila lo que llega (Alegra Bot solo ve lo registrado en Alegra).
- Mejoras tomadas de ese análisis: bitácora en vivo al procesar correos (pasos reales revelados uno por uno, como Ramp), avatares por proveedor (como Digits/Ramp), "Lo que no cuadra" como feed con estado vacío ("Nada para revisar hoy"), y **Preguntale a Pulso** (R21) con preguntas sugeridas, también por WhatsApp. Las respuestas se calculan con código y citan los correos de respaldo.
- `npm test`: 21 pruebas · `npm run eval`: 9/9, 0 falsos positivos.

**La demo pasa a ser un restaurante + reservas (viernes en la noche):**
- La bandeja de prueba ahora es "Restaurante La Fogata S.A." (carnes, bebidas, lácteos, mariscos, verduras, lavandería de manteles, cierre de caja de MesaFácil POS). Mismas cantidades, precios e IDs: los 9 casos plantados y sus montos no cambiaron.
- Reservas: Pulso lee el `.ics` de la plataforma ficticia ReservaYa y los pedidos que los clientes escriben directo (quedan "por confirmar"); una cancelación reemplaza a su reserva. Apartado "Reservas" (próximos 7 días por día), tarjeta "Reservas de hoy" en Inicio y la pregunta "¿Cuántas reservas tengo hoy?" (también por WhatsApp; entiende "mañana" y días de la semana).
- `npm run eval`: **9/9 · 0 falsos positivos · extracción 100 % (58 correos)** · `npm test`: 23 pruebas.

**Recordatorios con llamada (viernes en la noche):**
- "Acordame el viernes a las 9 que debo pagar la CCSS" por WhatsApp → `reminder.ts` lee día, hora y tarea con código (hoy, mañana, días de la semana, 26/11, "en 5 minutos", "3 de la tarde"); si no entiende cuándo, pregunta. Lo relaciona con el correo (CCSS ₡1 248 750, vence el 26/11) y avisa si el recordatorio queda después del vencimiento.
- A la hora, Pulso manda el WhatsApp y **llama**: en la demo, el celular del panel muestra la llamada entrante y la lee en voz alta (voz del navegador). Tarjeta "Tus recordatorios" con "Probar ahora".
- Límite: sin cron, la llamada sale cuando el panel está abierto. Siguiente paso: Supabase `pg_cron` + Twilio Voice.
- `npm test`: 25 pruebas · `npm run eval`: 9/9, 0 falsos positivos.

**Pulso lee WhatsApp (viernes en la noche):**
- Los mensajes del WhatsApp Business del restaurante (simulado) entran por el mismo flujo que el correo (`channel: "whatsapp"`): el motor no necesitó cambios. Nuevo caso plantado: la pescadería cobra ₡96 000 por WhatsApp sin factura → "cobro sin factura". También una reserva y un pago de cliente por WhatsApp.
- Etiqueta "WhatsApp" en alertas, mensajes y reservas; la sección "Correo" pasa a "Mensajes" con pestaña WhatsApp.
- Honestidad: WhatsApp no permite leer el WhatsApp personal del dueño; en producción se conecta el número Business del negocio (API de WhatsApp Business por Twilio o Meta) o el dueño reenvía mensajes a Pulso.
- `npm run eval`: **10/10 · 0 falsos positivos · extracción 100 % (61 mensajes)** · 25 pruebas.

## Sábado 21/11
- [ ] Qué se construyó:
- [ ] Resultado de `npm run eval`:
- [ ] Prueba con usuario real (restaurante):

## Domingo 22/11
- [ ] Qué se construyó:
- [ ] Resultado final de `npm run eval`:
- [ ] Lecciones aprendidas:
