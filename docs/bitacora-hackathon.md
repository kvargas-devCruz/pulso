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

## Sábado 21/11
- [ ] Qué se construyó:
- [ ] Resultado de `npm run eval`:
- [ ] Prueba con usuario real (restaurante):

## Domingo 22/11
- [ ] Qué se construyó:
- [ ] Resultado final de `npm run eval`:
- [ ] Lecciones aprendidas:
