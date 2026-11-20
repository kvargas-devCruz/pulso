# Playbook: prompts para Claude Code

Prompts listos para copiar, en orden. Aplican los tips del kickoff: **PRD con entrevista**, **plan mode**, **un agente (una sesión) por feature**, **tests** y **links probados**.

**Reglas para usarlo:**
- Antes de cada bloque grande, activá **plan mode** (Shift+Tab en Claude Code). Revisá el plan y solo después aprobá.
- **Una sesión por feature.** Al terminar una, hacé commit, cerrá la sesión y abrí otra para la siguiente.
- **Commit después de cada paso que funcione**, con un mensaje claro. Es tu historial para el README.
- Al final de cada día, corré `npm run eval` y anotá el resultado en `docs/bitacora-hackathon.md`.

---

## 0. Antes de empezar (viernes, 8:30)
- [ ] Repo creado en GitHub con `PRD.md`, `CLAUDE.md`, `docs/`, `data/`, `scripts/` y `supabase/`.
- [ ] **Punto de partida:** primer commit `docs: punto de partida (PRD, ADRs, datos de prueba)` + captura de pantalla. El FAQ pide documentar cómo estaba el proyecto al iniciar.
- [ ] `.env.local` con las llaves de Claude, Supabase y Twilio.
- [ ] Migración `supabase/migrations/0001_init.sql` aplicada en Supabase (SQL Editor → pegar → Run).

---

## VIERNES: construir el cerebro

### V1. Entrevista del PRD (15 min)
```
Leé CLAUDE.md, PRD.md y todos los archivos de docs/adr/. También data/bandeja-prueba/resumen.md.
Antes de escribir código, entrevistame: haceme entre 8 y 12 preguntas para encontrar huecos,
contradicciones o decisiones que falten en el PRD. Una pregunta a la vez.
Al final, proponé los cambios concretos al PRD.md y a los ADRs, y aplicalos cuando yo los apruebe.
```

### V2. Proyecto base (plan mode)
```
Creá el proyecto Next.js (App Router, TypeScript, Tailwind) en este repo siguiendo la estructura
de CLAUDE.md. Configurá el cliente de Supabase (servidor con service role y navegador con anon key)
y generá los tipos de TypeScript a partir de supabase/migrations/0001_init.sql.
Agregá .env.example con las variables de CLAUDE.md.
Agregá login simple con Supabase Auth (correo mágico) y una pantalla para crear la empresa.
Verificá que `npm run build` pase antes de decir que terminaste.
```

### V3. Adaptadores e ingesta (sesión nueva, plan mode)
```
Implementá lib/ingest con la interfaz común de ADR-0001:
- demo.ts: lee data/bandeja-prueba/<lote>/*.json.
- gmail.ts: misma interfaz, por ahora solo la firma y un TODO (se implementa el domingo).
Ruta POST /api/ingest {source:'demo', lote:'lote-1'|'lote-2'} que crea un run, guarda los correos en
emails (con content_hash e idempotencia por external_id) y llama al pipeline.
Pipeline en lib/engine/pipeline.ts con los pasos de ADR-0001; cada paso escribe en agent_log.
Por ahora los pasos de reglas y explicación quedan vacíos.
```

### V4. XML y Hacienda (sesión nueva, plan mode)
```
Implementá lib/engine/xml.ts y lib/engine/hacienda.ts según ADR-0002:
- Parsear FacturaElectronica (namespace v4.4): clave, consecutivo, emisor, cédula, fecha de emisión,
  condición de venta, plazo, total, impuesto y moneda. Calcular vencimiento = emisión + plazo.
  Contado = pagado.
- Parsear MensajeHacienda (Mensaje 1 = aceptado, 3 = rechazado) y relacionarlo por clave.
  Sin mensaje = sin_respuesta.
- Guardar en documents con amount_source='xml'.
Escribí pruebas con los archivos de data/bandeja-prueba: lote-1-14 debe quedar rechazado,
lote-1-16 sin_respuesta y los totales deben coincidir con esperado.json.
Corré las pruebas antes de terminar.
```

### V5. Extracción y clasificación con Claude (sesión nueva)
```
Implementá lib/engine/extract.ts y classify.ts:
- Correos sin XML: Claude Sonnet extrae contraparte, monto, moneda, vencimiento y tipo, en JSON
  validado con zod; si no valida, se reintenta una vez y si no, se marca como "revisar".
- Clasificación en las 8 categorías del PRD con Claude Haiku (en lote para ahorrar llamadas).
- Nunca sobreescribir montos que vienen del XML.
- Prompts en lib/engine/prompts/. Crear items a partir de los documentos.
Creá `npm run eval` (scripts/eval.ts): procesa lote-1 en una empresa de prueba y compara categoría,
tipo, monto, vencimiento y estado contra data/bandeja-prueba/esperado.json. Imprimí % de aciertos y
la lista de diferencias. Correlo y mostrame el resultado.
```

### V6. Panel v1 (sesión nueva)
```
Panel principal: bitácora del último run arriba ("Leí X correos · Y facturas · Hacienda aceptó A,
rechazó B y falta C"), tarjetas por categoría con total pendiente, lista de documentos con su estado
en Hacienda, y al tocar cualquier dato, el correo y el documento de origen (R5).
Botón "Procesar bandeja de prueba" (lote-1) y botón "Llegó un correo nuevo" (lote-2).
Español de Costa Rica (voseo), colones con formato ₡184 190. Diseño limpio y entendible para un dueño
que no es técnico.
```

### V7. Prueba de humo de WhatsApp
```
Implementá lib/notify/whatsapp.ts con Twilio y un botón oculto en /dev que mande
"Pulso conectado ✅" a OWNER_WHATSAPP_TO. Guardá el mensaje en whatsapp_messages.
```
**Fin del viernes:** `npm run eval` + commit + anotar en la bitácora.

---

## SÁBADO: construir la inteligencia

### S1. Reglas de alertas (sesión nueva, plan mode)
```
Implementá lib/engine/rules/ según la tabla de ADR-0003: duplicado, monto_inusual,
cobro_sin_factura, rechazo_hacienda y vencido. Cada regla es una función pura
(documentos + historial de proveedores → alertas con confidence, reason, rule_applied y
amount_at_risk). Actualizá la tabla suppliers desde documents.
Pruebas con la bandeja: después de lote-1 deben salir exactamente las alertas de esperado.json
(excepto el duplicado de Distribuidora del Valle, que aparece con lote-2). lote-1-16 es "revisar".
Extendé npm run eval para medir alertas detectadas y falsos positivos. Correlo.
```

### S2. Semáforo, pagos, cobros y dinero en riesgo
```
Semáforo (R11) calculado con código a partir de alertas e items, con una frase redactada por
Claude a partir de los datos (no inventar cifras). Secciones: vencidos, próximos 7 días, por cobrar,
dinero en riesgo. Según esperado.json, después de lote-1 el semáforo debe quedar rojo.
```

### S3. Evidencia lado a lado
```
Vista de detalle de alerta (R14): para un duplicado, los dos documentos lado a lado resaltando los
campos que coinciden; para un monto inusual, el historial del proveedor en una tabla o gráfico pequeño;
para un rechazo, el detalle del mensaje de Hacienda. Siempre: nivel de confianza, razón, regla aplicada,
fecha de análisis y enlace al correo.
```

### S4. WhatsApp de ida y vuelta (sesión nueva, plan mode)
```
Según ADR-0005: al crear una alerta alta o media, enviar un WhatsApp con resumen, monto, confianza y
link. Webhook /api/whatsapp/webhook (validar la firma de Twilio): "1" aprueba la acción de la última
alerta abierta, "2" la marca como normal (crea la regla aprendida), "VER" responde con el link.
Agrupar alertas de un mismo run en un solo mensaje y respetar un tope diario.
Probalo con ngrok o con el deploy en Vercel.
```

### S5. Borradores y aprobación
```
Para cada alerta, Claude redacta la acción (correo al proveedor, cobro o recordatorio) y se guarda en
actions como pendiente. Aprobar (panel o "1") cambia el estado a aprobada; mientras no esté Gmail,
mostrar el borrador listo para copiar. Nunca enviar nada (ADR-0004).
```

### S6. Aprende de tus decisiones (sesión nueva)
```
Según ADR-0007: botón "Esto es normal" con motivo opcional, también desde "2" en WhatsApp.
Crear learned_rules acotadas por proveedor y tipo. En el pipeline, antes de notificar, si una alerta
coincide con una regla activa, guardarla como normal_aprendido sin notificar y mostrarla en gris con
"Normal según tu decisión del [fecha]". Nunca aplicar a rechazo_hacienda. Pantalla para ver y borrar
reglas. Prueba: marcar normal la alerta de lote-1-19 y procesar lote-2 → lote-2-02 debe quedar como
normal_aprendido.
```

### S7. Tu semana
```
"Tu semana" (R18): lista priorizada por urgencia, monto y fecha, con la razón de cada prioridad.
También como mensaje de WhatsApp (botón para enviarlo ahora).
```

### S8. Usuario real
- Con permiso, reenviar 15–20 correos reales del restaurante a una cuenta de prueba y procesarlos
  (o exportarlos en el formato de la bandeja). Anotar qué encontró y qué falló en `docs/bitacora-hackathon.md`.

**Fin del sábado:** el flujo de la demo completo con la bandeja (lote-1 → enseñar → lote-2 → duplicado →
WhatsApp → "1" → borrador). `npm run eval` + commit.

---

## DOMINGO: convertirlo en producto

### D1. Gmail real (sesión nueva, plan mode)
```
Implementá lib/ingest/gmail.ts con OAuth de Google (modo de prueba), scopes gmail.readonly y
gmail.compose únicamente (ADR-0004). Leer correos recientes con adjuntos XML/PDF, misma interfaz que
demo.ts. Al aprobar una acción, crear el borrador en Gmail y guardar gmail_draft_id.
Botón para desconectar Gmail y borrar los datos de la empresa.
```

### D2. PDF e imágenes
```
Adjuntos PDF o imagen sin XML: extraer con la visión de Claude, marcar doubtful_fields y
amount_source='ia'. Mostrar un aviso "dato leído de PDF, confirmalo".
```

### D3. Cierre mensual
```
Cierre mensual para el contador (R19): resumen del mes con facturas (y estado en Hacienda), gastos,
ingresos, pendientes, anomalías y documentos que pidió el contador. Exportable (PDF o enlace).
```

### D4. Pulido y verificación
```
Revisá la app como si fueras un dueño de pyme que la usa por primera vez: primer uso en menos de
30 segundos, textos claros, estados vacíos, errores entendibles, se ve bien en el celular.
Corré npm run build, las pruebas y npm run eval. Arreglá lo que falle.
```
- [ ] Flujo de la demo **5 veces seguidas** sin fallar (resetear la empresa demo entre corridas).
- [ ] Grabar el **video de respaldo** de la demo.

### D5. Entrega (antes de las 10 p. m.)
- [ ] Completar el README: capturas, link de la app, punto de partida, cómo se usó agentic coding y resultado de `npm run eval`.
- [ ] Pitch deck (obligatorio), con el link en el formulario.
- [ ] Probar **todos los links en una ventana de incógnito y en el celular**: repo, app y deck.
- [ ] Llenar el formulario de Dojo (repo, deck y video) y la descripción para el marketplace.
- [ ] Post de lanzamiento (LinkedIn, X, comunidad) y grabación para el canal.
