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
  app/
    page.tsx                  # panel (usa components/Dashboard)
    api/state                 # GET: todo el estado del panel
    api/ingest                # POST {source:'demo', lote}: corre el pipeline
    api/alerts/[id]/(approve|normal|dismiss)
    api/rules/[id]            # DELETE: olvidar una regla aprendida
    api/emails/[id]           # GET: correo original + lo extraído
    api/whatsapp/(webhook|simulate|digest)
  components/                 # Dashboard, Phone (WhatsApp), Modals (evidencia, correo, borrador)
  lib/
    types.ts                  # tipos del dominio
    ingest/                   # adaptadores: demoAdapter, gmailAdapter (misma interfaz)
    engine/
      pipeline.ts             # el único flujo central + decisiones (aprobar, normal, WhatsApp)
      xml.ts                  # FacturaElectronica y MensajeHacienda (código, ADR-0002)
      extract.ts              # extracción: XML → Claude → heurística
      claude.ts               # llamadas a Claude con zod; polish() con guardia de números
      rules.ts                # reglas puras con confianza + reglas aprendidas
      status.ts               # semáforo, próximos 7 días, Tu semana
      explain.ts              # explicaciones, borradores y texto de WhatsApp
    store/                    # Store: SupabaseStore (producción) | LocalStore (demo)
    notify/whatsapp.ts        # Twilio + validación de firma
    state.ts                  # arma el estado del panel
supabase/migrations/          # esquema
data/bandeja-prueba/          # lote-1/, lote-2/, esperado.json, resumen.md (FICTICIOS)
scripts/                      # generar_bandeja.py, eval.ts
docs/                         # adr/, PLAYBOOK.md, bitacora-hackathon.md
```

## Reglas que no se rompen
1. **Un solo flujo central.** Toda fuente pasa por `lib/engine/pipeline.ts` y todo se guarda en el Store (Supabase en producción; archivo local solo para la demo). Dashboard y WhatsApp leen y escriben las mismas tablas. Nunca dupliques lógica por canal. (ADR-0001)
2. **Los números salen de código.** Montos, impuestos, consecutivos, clave numérica y estado de Hacienda se leen del XML con un parser. La IA nunca calcula ni inventa montos o fechas; si no hay XML, lo que extrae la IA se marca con su confianza. (ADR-0002)
3. **Las alertas son reglas explícitas** en `lib/engine/rules.ts`, cada una con nivel de confianza (alta/media/baja) y una razón legible. La IA solo redacta la explicación a partir de los datos de la regla. (ADR-0003)
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
- Prompts a Claude en `lib/engine/claude.ts` con salida JSON validada con zod. Si la respuesta no valida, se reintenta una vez y si no, se usa la heurística.

## Modelos
- Clasificación de volumen: Claude Haiku.
- Extracción de correos sin XML, visión de PDF e imágenes, explicaciones y borradores: Claude Sonnet.
- La API key va en `ANTHROPIC_API_KEY`; nunca en el código.

## Pruebas
- `npm test`: pruebas unitarias (`src/lib/engine/engine.test.ts`).
- `npm run eval`: procesa `data/bandeja-prueba/` de punta a punta y compara contra `esperado.json` (extracción, alertas, semáforo, aprendizaje). Correrlo después de cambiar el motor o los prompts. Debe quedar 8/8 alertas y 0 falsos positivos.
- Antes de decir "listo": `npm run build`, `npm test` y `npm run eval`.

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
PULSO_TODAY=          # opcional: fija el "hoy" (demo: 2026-11-20)
PULSO_USE_CLAUDE=     # 0 para forzar la heurística
PULSO_MODEL=          # por defecto claude-sonnet-5-5
```
