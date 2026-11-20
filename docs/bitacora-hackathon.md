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

## Sábado 21/11
- [ ] Qué se construyó:
- [ ] Resultado de `npm run eval`:
- [ ] Prueba con usuario real (restaurante):

## Domingo 22/11
- [ ] Qué se construyó:
- [ ] Resultado final de `npm run eval`:
- [ ] Lecciones aprendidas:
