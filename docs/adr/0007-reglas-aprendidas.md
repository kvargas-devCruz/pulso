# ADR-0007: Aprender de las decisiones del dueño, con límites

**Estado:** aceptada · 19/11/2026

## Contexto
Si Pulso alerta una y otra vez por algo que el dueño ya sabe que es normal (un proveedor que cobra más en temporada), deja de leer las alertas. Pero aprender sin control puede esconder problemas reales.

## Decisión
- En cada alerta, el dueño puede marcar **"Esto es normal"** (panel o "2" en WhatsApp), con un motivo opcional.
- Se crea una `regla_aprendida` acotada: **empresa + proveedor + tipo de alerta + condición** (por ejemplo, umbral de monto para ese proveedor en ese mes, o un patrón de duplicado aceptado).
- Cuando una alerta coincide con una regla aprendida, no notifica: se guarda con estado `normal_aprendido` y se muestra en gris con "Normal según tu decisión del [fecha]".
- La bitácora cuenta cuántas alertas se silenciaron por reglas aprendidas.
- Las reglas se pueden ver, desactivar y borrar desde la configuración.
- **Nunca** se aprende a ignorar un **rechazo de Hacienda**.

## Consecuencias
- (+) Menos ruido con el uso: el agente mejora en vez de molestar.
- (+) Transparente: nada se silencia en secreto.
- (−) Una regla demasiado amplia podría esconder un caso real; por eso son acotadas por proveedor y tipo.
