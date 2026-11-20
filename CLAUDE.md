# CLAUDE.md: Pulso

Instrucciones para Claude Code en este repositorio. Leé esto antes de cualquier cambio.

## Qué es
Pulso es un agente que vigila el correo de una pyme costarricense: extrae facturas y avisos, revisa su estado en Hacienda, detecta riesgos (posibles duplicados, montos inusuales, cobros sin factura, rechazos de Hacienda, vencimientos), avisa por WhatsApp y prepara borradores que el dueño aprueba.

- Requerimientos: `PRD.md`
- Decisiones técnicas: `docs/adr/`
- Datos de prueba: `data/bandeja-prueba/lote-1/` (36 correos ya en el buzón) y `lote-2/` (2 correos que "llegan en vivo"). Se generan con `python3 scripts/generar_bandeja.py`.
- Respuesta esperada: `data/bandeja-prueba/esperado.json` (para `npm run eval`) y `resumen.md` (legible). "Hoy" en la demo es el 20/11/2026.
- Esquema de la base de datos: `supabase/migrations/0001_init.sql`
- Orden de trabajo y prompts por bloque: `docs/PLAYBOOK.md`

Si algo no está claro en el PRD o en los ADRs, preguntá antes de inventar.

## Stack
Next.js (App Router, TypeScript) · Supabase (Postgres + Auth) · API de Claude (`@anthropic-ai/sdk`) · Gmail API · Twilio WhatsApp (sandbox) · Vercel.

## Estructura
```
src/
  app/                      # páginas y rutas API de Next.js
    api/ingest/             # dispara el procesamiento de una fuente
    api/whatsapp/webhook/   # respuestas "1", "2", "VER" de Twilio
    api/gmail/              # OAuth y creación de borradores
  lib/
    ingest/                 # adaptadores: demo.ts, gmail.ts (misma interfaz)
    engine/                 # motor: pipeline.ts, xml.ts, hacienda.ts,
                            # extract.ts, classify.ts, rules/, explain.ts, log.ts
    notify/whatsapp.ts      # envío por Twilio
    db/                     # cliente y tipos de Supabase
supabase/migrations/        # esquema (ver docs/adr y PRD)
data/bandeja-prueba/        # lote-1/, lote-2/, esperado.json, resumen.md (FICTICIOS)
scripts/                    # generar_bandeja.py, eval.ts
docs/adr/                   # decisiones de arquitectura
docs/PLAYBOOK.md            # prompts por bloque
docs/bitacora-hackathon.md  # qué se hizo cada día (para el README)
```

## Reglas que no se rompen
1. **Un solo flujo central.** Toda fuente pasa por `lib/engine/pipeline.ts` y todo se guarda en Supabase. Dashboard y WhatsApp leen y escriben las mismas tablas. Nunca dupliques lógica por canal. (ADR-0001)
2. **Los números salen de código.** Montos, impuestos, consecutivos, clave numérica y estado de Hacienda se leen del XML con un parser. La IA nunca calcula ni inventa montos o fechas; si no hay XML, lo que extrae la IA se marca con su confianza. (ADR-0002)
3. **Las alertas son reglas explícitas** en `lib/engine/rules/`, cada una con nivel de confianza (alta/media/baja) y una razón legible. La IA solo redacta la explicación a partir de los datos de la regla. (ADR-0003)
4. **Nada se envía sin aprobación.** Gmail usa solo `gmail.readonly` y `gmail.compose` (borradores). Nunca `gmail.send`. (ADR-0004)
5. **Toda alerta y todo dato enlaza a su fuente** (correo y documento).
6. **Las reglas aprendidas nunca silencian un rechazo de Hacienda.** (ADR-0007)
7. **Cada paso del pipeline escribe en la bitácora.**
8. **Lenguaje:** "posible duplicado", "monto fuera de lo normal". Nunca "fraude".

## Estilo
- La interfaz va en español de Costa Rica (voseo: "revisá", "tenés"). El código y los nombres de variables, en inglés.
- Colones con formato `₡185 400` (espacio como separador de miles).
- Fechas en `America/Costa_Rica`.
- TypeScript estricto. Funciones de reglas puras (entrada → alertas) para poder probarlas.
- Prompts a Claude en `lib/engine/prompts/` con salida JSON validada (por ejemplo, con zod). Si la respuesta no valida, se reintenta una vez y si no, se marca como "revisar".

## Modelos
- Clasificación de volumen: Claude Haiku.
- Extracción de correos sin XML, visión de PDF e imágenes, explicaciones y borradores: Claude Sonnet.
- La API key va en `ANTHROPIC_API_KEY`; nunca en el código.

## Pruebas
- Las reglas de `lib/engine/rules/` tienen pruebas con casos de la bandeja demo.
- Script `npm run eval`: procesa `data/bandeja-prueba/` y compara contra `resumen.md` (clasificación, extracción, alertas, semáforo). Correrlo después de cambiar el motor o los prompts.

## Prioridad cuando haya que elegir
1. El flujo principal: duplicado → evidencia → WhatsApp → "1" → borrador en Gmail.
2. Rechazo de Hacienda.
3. Aprende de tus decisiones.
4. Todo lo demás.
Una demo que funciona vale más que una función nueva.

## Variables de entorno
```
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
OWNER_WHATSAPP_TO=whatsapp:+506XXXXXXXX
APP_URL=
```
