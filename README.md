# Pulso

**El estado de tu empresa, leído de tu correo.**

> Proyecto del equipo **WildDogs** para el Dojo AI Hackathon (Track 02: Build for Business, noviembre 2026).

---

## 1. Qué hace y para quién

**El problema, en dos líneas:** las pymes de Costa Rica reciben facturas, avisos de Hacienda y la CCSS, cobros y mensajes del contador, todo en un solo correo que nadie revisa con calma. Ahí se pierden vencimientos, se pagan facturas duplicadas o infladas y se usan facturas que Hacienda rechazó.

**La solución:** Pulso se conecta al correo y le arma al dueño el **estado de su empresa**: qué debe, qué vence, qué le deben y qué no cuadra. Lee las facturas electrónicas directo del XML, revisa si Hacienda las aceptó, detecta riesgos con evidencia y le manda **señales por WhatsApp**. El dueño responde "1" y Pulso le deja listo el correo para resolverlo. **Nada se envía sin su aprobación.**

**Para quién:** dueños y administradores de pymes de 2 a 30 personas (restaurantes, comercios, servicios) que reciben facturas por correo y trabajan con un contador externo. Funciona con cualquier sistema contable, o sin ninguno.

*Alegra administra lo que ya registraste. Pulso vigila lo que está llegando a tu empresa.*

### Qué hace hoy
- **Semáforo de salud** (verde, amarillo o rojo) con lo vencido, lo que no cuadra, lo que vence en 7 días y el dinero en riesgo.
- **Lee las facturas electrónicas del XML con código** (montos exactos) y la **respuesta de Hacienda** (aceptada / rechazada / sin respuesta).
- **Detecta riesgos con reglas explícitas y nivel de confianza:** posible duplicado (exacto o probable), monto fuera de lo normal según el historial del proveedor, cobro sin factura, factura rechazada por Hacienda, vencidos (por pagar y por cobrar) y **cierre que no cuadra** (las ventas con tarjeta del cierre de caja contra el cierre del datáfono del mismo día).
- **Evidencia lado a lado:** los dos documentos comparados, el historial del proveedor, la regla aplicada.
- **WhatsApp:** alerta agrupada; respondés **1** (preparar correo), **2** (es normal) o **VER** (detalle).
- **Aprende de tus decisiones:** "es normal" crea una regla acotada al proveedor; los casos parecidos quedan en gris sin molestar. Nunca aprende a ignorar un rechazo de Hacienda.
- **Borradores con aprobación:** correo al proveedor, cobro al cliente o recordatorio, listos para copiar o abrir en tu correo.
- **Tu semana**, lo que te deben, tu correo ordenado por categoría y la **bitácora** de lo que hizo el agente, que se ve **en vivo, paso a paso**, cada vez que llega correo.
- **Próximas reservas** (restaurantes): Pulso lee las reservas que llegan por correo (de la plataforma de reservas, con su `.ics`, y de clientes que escriben directo), las agrupa por día con personas, notas y anticipos, y marca las canceladas y las que faltan confirmar.
- **Preguntale a Pulso** (en el panel o por WhatsApp): "¿Cuánto debo esta semana?", "¿Cuadró el datáfono ayer?", "¿Cuánto le debo a Cementos?". La respuesta se calcula con código y muestra los correos de donde salió.

---

## 2. Cómo correrlo

**App publicada:** https://pulso-mu-nine.vercel.app (datos en Supabase). Tocá **"Probar con la bandeja de prueba"**.
> El prototipo no tiene login: cualquiera con el link puede cargar la bandeja o tocar **Reiniciar**. Todos los datos son ficticios.

### Requisitos
- Node.js 20 o superior (probado con Node 22).
- Nada más para la demo. Las llaves de Claude, Supabase y Twilio son opcionales (ver abajo).

### En 3 pasos
```bash
git clone https://github.com/kvargas-devCruz/pulso.git
cd pulso
npm install
npm run dev            # http://localhost:3000
```
En el panel, tocá **"Probar con la bandeja de prueba"** (Restaurante La Fogata S.A., empresa ficticia).

### Guion de la demo
1. **Probar con la bandeja de prueba** → semáforo en rojo, bitácora y 8 riesgos (incluye el cierre del datáfono del 17/11 que no cuadra).
2. En "Monto fuera de lo normal" de **Verdulería La Huerta**, tocá **Es normal** (temporada navideña).
3. Tocá **📩 Llegó un correo nuevo** → Pulso muestra lo que hace paso a paso y termina en el **posible duplicado** de Distribuidora de Carnes del Valle; la alerta llega al WhatsApp. También llega una reserva nueva para hoy (mirala en **Reservas**).
4. **Ver evidencia** → las dos facturas lado a lado (misma clave, mismo consecutivo).
5. En la sección **WhatsApp** respondé **1** → el correo al proveedor queda listo. No se envió nada.
6. La nueva factura de temporada de Verdulería La Huerta quedó en gris: *normal según tu decisión*.

**Reiniciar** borra los datos de prueba para volver a empezar.

### Conectar los servicios reales (opcional)
Copiá `.env.example` a `.env.local` y completá lo que quieras usar:

| Variable | Para qué | Sin ella |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude entiende los correos sin XML (avisos, cobros, solicitudes) | Se usa una heurística determinista |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Guardar todo en Supabase (fuente de verdad en producción) | Se guarda en `.data/pulso.json` |
| `TWILIO_*`, `OWNER_WHATSAPP_TO` | Enviar y recibir WhatsApp de verdad (sandbox de Twilio) | WhatsApp simulado en el panel |
| `APP_URL` | Links dentro de los mensajes de WhatsApp | `http://localhost:3000` |
| `PULSO_TODAY` | Fijar el "hoy" (la demo usa 2026-11-20) | Fecha actual de Costa Rica |

**Supabase:** en el SQL Editor de tu proyecto (**New → Snippet**, vacío) pegá y ejecutá `supabase/migrations/0001_init.sql` y después `0002_cierres.sql` (cada una en su propio Snippet). Incluye los `grant` que los proyectos nuevos de Supabase ya no dan solos a la Data API. Para comprobar que el Store de Supabase funciona: `npm run eval:supabase` (usa `.env.local` y una empresa de eval aparte).
**WhatsApp (Twilio Sandbox):** uní tu celular al sandbox y configurá el webhook "When a message comes in" a `https://TU-APP/api/whatsapp/webhook` (POST).

### Pruebas
```bash
npm test         # pruebas unitarias del lector de XML, las heurísticas y las reglas
npm run eval     # procesa la bandeja de prueba de punta a punta y la compara con esperado.json
npm run eval:supabase  # lo mismo, guardando en Supabase real (necesita .env.local)
npm run build    # compilación de producción
```

Resultado actual de `npm run eval` (sin Claude):
```
Extracción (lote 1): categoría, tipo, monto, vencimiento, estado y Hacienda: 100 %
Alertas: 9/9 plantadas detectadas · 0 falsos positivos
Aprendizaje: la factura de temporada del lote 2 quedó como normal_aprendido
```
> Honestidad sobre esa cifra: las facturas y su estado en Hacienda se leen del XML (exacto). Para los correos sin XML, la heurística se escribió conociendo la bandeja de prueba, así que el 100 % mide que el flujo funciona, no la precisión con correos reales. Con correos reales, la extracción de texto la hace Claude (`ANTHROPIC_API_KEY`); medir eso con correos reales del restaurante es el siguiente paso.

---

## 3. Cómo usé agentic coding

**Herramientas:** Claude (Claude Code) para planear y construir, y la API de Claude dentro del producto.

**Flujo de trabajo:**
1. **Criterio primero.** Antes de escribir código definí el producto en [`PRD.md`](PRD.md), las decisiones técnicas en [`docs/adr/`](docs/adr/) y las reglas para el agente en [`CLAUDE.md`](CLAUDE.md).
2. **Datos de prueba con respuesta esperada.** [`scripts/generar_bandeja.py`](scripts/generar_bandeja.py) genera 61 correos ficticios de un restaurante con casos plantados y [`esperado.json`](data/bandeja-prueba/esperado.json). Así el agente verifica su propio trabajo con `npm run eval`.
3. **Construcción por bloques**, cada uno verificado con build, pruebas y eval antes de seguir (ver [`docs/bitacora-hackathon.md`](docs/bitacora-hackathon.md)).
4. **Revisión visual:** el agente abrió el panel en un navegador sin interfaz, ejecutó el flujo completo de la demo y revisó capturas de escritorio y celular (así encontró y corrigió un desborde horizontal en el celular).
5. **Revisión humana** de cada decisión contra el PRD y los ADRs.

**Archivos:**
- [`PRD.md`](PRD.md): qué es el producto, para quién, qué hace y qué no.
- [`docs/adr/`](docs/adr/): 7 decisiones de arquitectura.
- [`CLAUDE.md`](CLAUDE.md): instrucciones y reglas que sigue el agente.
- [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md): los prompts por bloque.
- [`docs/bitacora-hackathon.md`](docs/bitacora-hackathon.md): qué se hizo cada día, desde el punto de partida.

---

## Arquitectura en una imagen
```
Fuentes (adaptadores)        Motor (src/lib/engine)                 Salidas
bandeja demo ─┐     guardar + hash → XML (código) → Hacienda →     ┌─ Panel
Gmail ────────┴──►  extraer (Claude | heurística) → clasificar → ──┼─ WhatsApp
                    reglas (confianza) → lo aprendido → explicar    └─ Borradores
                                      │
                         Store: Supabase (producción) | archivo local (demo)
```

## Privacidad
Gmail en solo lectura más borradores (nunca envía correos). Nada se envía sin aprobación. Los WhatsApp llevan un resumen y un link, no el XML. La bandeja de prueba es 100 % ficticia.

## Pendiente
- Conexión real con Gmail (OAuth `gmail.readonly` + `gmail.compose`) y guardar los borradores en Gmail.
- Leer PDF e imágenes con la visión de Claude.
- Cierre mensual para el contador.
- Prueba con correos reales de un restaurante.
