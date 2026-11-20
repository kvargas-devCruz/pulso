# ADR-0004: Aprobación humana siempre y permisos mínimos en Gmail

**Estado:** aceptada · 19/11/2026

## Contexto
Pulso lee correos de una empresa y redacta mensajes a proveedores y clientes. Enviar algo por error, o pedir más permisos de los necesarios, rompe la confianza y complica la verificación de Google.

## Decisión
- Scopes de Gmail: **`gmail.readonly`** (leer) y **`gmail.compose`** (crear borradores). **Nunca `gmail.send`.**
- Toda acción (correo al proveedor, cobro, recordatorio) se crea como `acción` en estado `pendiente`. Al aprobarla (panel o "1" en WhatsApp) se guarda como **borrador en Gmail**; el dueño lo envía desde su correo.
- Se registra quién aprobó, cuándo y desde qué canal.
- OAuth en modo de prueba de Google Cloud (usuarios de prueba) para el hackathon. El usuario puede desconectar y borrar sus datos.

## Consecuencias
- (+) Respuesta clara a "¿y si la IA se equivoca?": nada sale sin que el dueño lo vea.
- (+) Permisos mínimos y fáciles de explicar.
- (−) Un paso extra para el dueño (enviar el borrador); se acepta a propósito.
