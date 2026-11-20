# ADR-0002: Los montos y el estado de Hacienda salen del XML con código, no de la IA

**Estado:** aceptada · 19/11/2026

## Contexto
En Costa Rica las facturas electrónicas llegan por correo con su XML, normalmente acompañado del mensaje de respuesta de Hacienda. Un modelo de lenguaje puede leer números mal o inventarlos, y en un producto que habla de plata eso destruye la confianza.

## Decisión
- Montos, impuestos, número consecutivo, clave numérica, emisor e identificación se leen del XML con un **parser determinista**.
- El estado en Hacienda (Aceptado / Rechazado) se lee del XML de respuesta y se relaciona con su factura por la **clave numérica**. Sin respuesta → `sin_respuesta` ("revisar").
- Claude se usa solo donde no hay estructura: correos sin XML, PDF e imágenes (visión), clasificación y redacción. Esos datos se guardan con `confianza_extracción` y `campos_dudosos`.
- La IA nunca recalcula un monto que ya vino del XML.

## Consecuencias
- (+) Los números de la demo son exactos y defendibles frente al jurado.
- (−) Hay que validar el formato real del XML de respuesta de Hacienda con correos reales antes de escribir el lector.
