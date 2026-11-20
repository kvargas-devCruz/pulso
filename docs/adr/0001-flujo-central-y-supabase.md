# ADR-0001: Un solo flujo central con adaptadores y Supabase como fuente de verdad

**Estado:** aceptada · 19/11/2026

## Contexto
Pulso recibe correos de dos fuentes (bandeja demo y Gmail) y los entrega por dos canales (dashboard y WhatsApp). Si cada combinación tiene su propia lógica, en un fin de semana terminamos con tres sistemas que no coinciden.

## Decisión
- Las fuentes son **adaptadores** con la misma interfaz (`fetchEmails(): RawEmail[]`). Cambiar de demo a Gmail no toca el motor.
- Todo pasa por un único **pipeline**: guardar correo + hash → extraer → validar Hacienda → clasificar → reglas → explicar → bitácora.
- **Supabase es la única fuente de verdad**: documentos, datos extraídos, alertas, acciones, aprobaciones, reglas aprendidas y bitácora.
- El dashboard y WhatsApp leen y escriben las mismas tablas. Una aprobación desde WhatsApp se refleja en el panel y viceversa.

## Consecuencias
- (+) La demo puede usar la bandeja de prueba y el producto real usar Gmail con el mismo código.
- (+) Un solo lugar para probar y medir (`npm run eval`).
- (−) El modelo de datos se diseña completo desde el viernes, aunque algunas tablas se usen hasta el sábado.
