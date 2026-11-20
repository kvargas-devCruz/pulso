# ADR-0003: Las alertas son reglas explícitas con nivel de confianza

**Estado:** aceptada · 19/11/2026

## Contexto
Acusar a un proveedor de cobrar doble cuando no lo hizo es grave. Las alertas tienen que ser predecibles, explicables y auditables.

## Decisión
Cada tipo de alerta es una función pura en `lib/engine/rules/` que recibe documentos e historial y devuelve alertas con `confianza`, `razón` y `regla_aplicada`:

| Regla | Alta | Media | Baja ("revisar") |
|---|---|---|---|
| Posible duplicado | mismo emisor + mismo consecutivo | mismo emisor + mismo monto, ≤ 15 días, consecutivo distinto | coincidencia parcial o datos dudosos |
| Monto inusual | > 2× el promedio del proveedor, con ≥ 3 facturas previas | > 1.5× el promedio, con ≥ 2 facturas previas | menos de 2 facturas previas |
| Cobro sin factura | correo de cobro con monto y sin XML relacionado | — | monto no claro |
| Rechazo de Hacienda | mensaje de Hacienda "Rechazado" | — | sin respuesta de Hacienda |
| Vencimiento | fecha de vencimiento pasada | vence en ≤ 7 días | fecha extraída con dudas |

- Solo las alertas **alta** y **media** notifican por WhatsApp. **Baja** aparece como "revisar" en el panel.
- La IA redacta la explicación a partir de los campos de la alerta; no decide si hay alerta.
- Los umbrales son configurables y se ajustan con las reglas aprendidas (ADR-0007).

## Consecuencias
- (+) Cada alerta se puede explicar con "esta regla, con estos datos".
- (+) Las reglas se prueban contra `resumen.md`.
- (−) Patrones raros que una regla no cubre no se detectan; se acepta para el prototipo.
