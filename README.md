# Pulso

**El estado de tu empresa, leído de tu correo.**

> Proyecto del equipo **WildDogs** para el Dojo AI Hackathon (Track 02: Build for Business, noviembre 2026).
> *Este README es una base: completá las secciones marcadas con [ ] a medida que construís.*

---

## 1. Qué hace y para quién

**El problema, en dos líneas:** las pymes de Costa Rica reciben decenas de facturas, avisos de Hacienda y la CCSS, cobros y mensajes del contador en un solo correo que nadie revisa con calma. Ahí se pierden vencimientos, se pagan facturas duplicadas o infladas y se usan facturas que Hacienda rechazó.

**La solución:** Pulso se conecta al correo, lee las facturas electrónicas directo del XML, revisa si Hacienda las aceptó, detecta lo que no cuadra y avisa al dueño por WhatsApp con la evidencia. El dueño responde "1" y Pulso le deja listo el correo para resolverlo. Nada se envía sin su aprobación.

**Para quién:** dueños y administradores de pymes de 2 a 30 personas (restaurantes, comercios, servicios) que reciben facturas por correo y trabajan con un contador externo. Funciona con cualquier sistema contable, o sin ninguno.

*Alegra administra lo que ya registraste. Pulso vigila lo que está llegando a tu empresa.*

### Funciones
- Semáforo de salud de la empresa (verde, amarillo o rojo) con montos y fuentes.
- Posibles duplicados, montos fuera de lo normal, cobros sin factura y facturas rechazadas por Hacienda, cada uno con nivel de confianza y evidencia lado a lado.
- Alertas por WhatsApp: "1" prepara el borrador en Gmail, "2" marca el caso como normal y Pulso lo aprende.
- Pagos vencidos y próximos, cobros pendientes, "Tu semana" y cierre mensual para el contador.
- Bitácora visible de lo que hizo el agente.

[ ] Capturas de pantalla / GIF
[ ] Link a la app desplegada
[ ] Link al pitch deck y al video

---

## 2. Cómo correrlo

### Requisitos
- Node.js 20+
- Cuenta de Supabase, API key de Claude, cuenta de Twilio (sandbox de WhatsApp) y, para Gmail real, un proyecto de Google Cloud con OAuth.

### Pasos
```bash
git clone [URL del repo]
cd pulso
npm install
cp .env.example .env.local   # completar las variables (ver abajo)
[ ] comando para aplicar las migraciones de Supabase
npm run dev                  # http://localhost:3000
```

### Probarlo sin conectar nada (modo demo)
1. Abrí la app y elegí **"Usar bandeja de prueba"** (Ferretería El Roble S.A., empresa ficticia).
2. Tocá **"Procesar bandeja"**.
3. Revisá el semáforo, las alertas y la evidencia.
4. Para WhatsApp: uní tu celular al sandbox de Twilio y poné tu número en `OWNER_WHATSAPP_TO`.

### Medir la precisión
```bash
npm run eval   # procesa data/bandeja-prueba y compara contra resumen.md
```

### Variables de entorno
Ver `.env.example` y la sección "Variables de entorno" en `CLAUDE.md`.

---

## 3. Cómo usé agentic coding

**Herramienta:** Claude Code (con Claude Pro), más la API de Claude dentro del producto.

**Flujo de trabajo:**
1. **Criterio primero.** Antes de escribir código definí el producto en `PRD.md`, las decisiones técnicas en `docs/adr/` y las reglas para el agente en `CLAUDE.md`.
2. **Construcción por bloques.** Viernes: el cerebro (ingesta, XML, Hacienda, extracción, panel). Sábado: la inteligencia (reglas, semáforo, evidencia, WhatsApp, aprendizaje). Domingo: Gmail real, PDF, cierre mensual y pulido.
3. **Verificación.** `npm run eval` compara cada cambio contra la respuesta esperada de la bandeja de prueba.
4. **Revisión humana.** Yo revisé cada cambio del agente contra el PRD y los ADRs.

**Archivos en el repo:**
- [`PRD.md`](PRD.md): qué es el producto, para quién, qué hace y qué no.
- [`docs/adr/`](docs/adr/): 7 decisiones de arquitectura (flujo central, números desde XML, reglas con confianza, aprobación humana, WhatsApp, stack, reglas aprendidas).
- [`CLAUDE.md`](CLAUDE.md): instrucciones y reglas que el agente sigue en este repo.
- [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md): los prompts que usé, bloque por bloque (entrevista del PRD, plan mode, una sesión por feature, pruebas).
- [`docs/bitacora-hackathon.md`](docs/bitacora-hackathon.md): qué se hizo cada día, desde el punto de partida.
- [`data/bandeja-prueba/`](data/bandeja-prueba/): 38 correos ficticios con casos plantados y su respuesta esperada (`esperado.json`), generados con [`scripts/generar_bandeja.py`](scripts/generar_bandeja.py). Con eso, `npm run eval` mide cuánto acierta el agente.

[ ] Punto de partida (cómo estaba el proyecto al iniciar el hackathon)
[ ] Qué construyó el agente y qué ajusté yo
[ ] Lecciones aprendidas

---

## Privacidad
Gmail en solo lectura más borradores (nunca envía correos). Los datos de cada empresa están aislados y se pueden borrar. Los WhatsApp solo llevan un resumen y un link. La bandeja de prueba es 100% ficticia.
