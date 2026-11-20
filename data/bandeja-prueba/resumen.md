# Bandeja de prueba: Restaurante La Fogata S.A. (FICTICIA)

Hoy en la demo: **20/11/2026**. Generada con `scripts/generar_bandeja.py` (reproducible).
Todo es inventado. Los XML siguen de forma simplificada la factura electrónica v4.4 y el mensaje de Hacienda, sin firma digital.

- Lote 1 (ya en el buzón): **61 correos**
- Lote 2 (llegan en vivo durante la demo): **3 correos**

## Correos y lo que se debe extraer

| ID | Asunto | Categoría | Tipo | Monto | Vence | Estado / Hacienda |
|---|---|---|---|---|---|---|
| lote-1-01 | Factura electrónica 00100001010000001001 - Distribuidora de  | proveedores | factura | ₡171 760 | — | aceptado |
| lote-1-02 | Factura electrónica 00100001010000001002 - Distribuidora de  | proveedores | factura | ₡165 827,50 | — | aceptado |
| lote-1-03 | Factura electrónica 00100001010000001003 - Distribuidora de  | proveedores | factura | ₡184 190 | 2026-12-05 | aceptado |
| lote-1-04 | Factura electrónica 00100001010000001138 - Cervecería y Bebi | proveedores | factura | ₡147 917 | — | aceptado |
| lote-1-05 | Factura electrónica 00100001010000001139 - Cervecería y Bebi | proveedores | factura | ₡141 193,50 | — | aceptado |
| lote-1-06 | Factura electrónica 00100001010000001140 - Cervecería y Bebi | proveedores | factura | ₡154 640,50 | — | aceptado |
| lote-1-07 | Factura electrónica 00100001010000001141 - Cervecería y Bebi | proveedores | factura | ₡416 857 | 2026-12-17 | aceptado |
| lote-1-08 | Factura electrónica 00100001010000001275 - Lácteos La Prader | proveedores | factura | ₡98 988 | — | aceptado |
| lote-1-09 | Factura electrónica 00100001010000001276 - Lácteos La Prader | proveedores | factura | ₡82 490 | — | aceptado |
| lote-1-10 | Factura electrónica 00100001010000001277 - Lácteos La Prader | proveedores | factura | ₡96 050 | 2026-12-10 | aceptado |
| lote-1-11 | Factura electrónica 00100001010000001278 - Lácteos La Prader | proveedores | factura | ₡96 050 | 2026-12-13 | aceptado |
| lote-1-12 | Factura electrónica 00100001010000001412 - Mariscos del Pací | proveedores | factura | ₡124 300 | — | aceptado |
| lote-1-13 | Factura electrónica 00100001010000001413 - Mariscos del Pací | proveedores | factura | ₡93 225 | — | aceptado |
| lote-1-14 | Factura electrónica 00100001010000001414 - Mariscos del Pací | proveedores | factura | ₡109 610 | 2026-12-12 | rechazado |
| lote-1-15 | Factura electrónica 00100001010000001549 - Desechables Eco S | proveedores | factura | ₡66 105 | — | aceptado |
| lote-1-16 | Factura electrónica 00100001010000001550 - Desechables Eco S | proveedores | factura | ₡70 512 | 2026-12-18 | sin_respuesta |
| lote-1-17 | Factura electrónica 00100001010000001686 - Verdulería La Hue | proveedores | factura | ₡198 315 | — | aceptado |
| lote-1-18 | Factura electrónica 00100001010000001687 - Verdulería La Hue | proveedores | factura | ₡202 722 | — | aceptado |
| lote-1-19 | Factura electrónica 00100001010000001688 - Verdulería La Hue | proveedores | factura | ₡363 577,50 | 2026-12-14 | aceptado |
| lote-1-20 | Factura electrónica 00100001010000001823 - Lavandería Mantel | proveedores | factura | ₡94 920 | — | aceptado |
| lote-1-21 | Factura electrónica 00100001010000001824 - Lavandería Mantel | proveedores | factura | ₡94 920 | 2026-12-01 | aceptado |
| lote-1-22 | Factura electrónica 00100001010000001960 - Contadores Asocia | proveedores | factura | ₡84 750 | — | aceptado |
| lote-1-23 | Documentos pendientes para el cierre de octubre | contador | solicitud | — | 2026-11-25 | pendiente |
| lote-1-24 | IVA de octubre presentado | contador | aviso | ₡612 300 | — | pagado |
| lote-1-25 | Recordatorio: declaración del IVA de noviembre | hacienda | aviso | — | 2026-12-15 | pendiente |
| lote-1-26 | Tiene un nuevo mensaje en su buzón de TRIBU-CR | hacienda | aviso | — | — | informativo |
| lote-1-27 | Facturación de planilla noviembre 2026 | ccss | cobro | ₡1 248 750 | 2026-11-26 | pendiente |
| lote-1-28 | Renovación póliza de Riesgos del Trabajo | ins | cobro | ₡182 400 | 2026-11-30 | pendiente |
| lote-1-29 | Aviso: cuota de préstamo vencida | bancos | cobro | ₡425 000 | 2026-11-15 | vencido |
| lote-1-30 | Su estado de cuenta de octubre está disponible | bancos | aviso | — | — | informativo |
| lote-1-31 | Pago pendiente hielo de noviembre | proveedores | cobro | ₡310 000 | — | pendiente |
| lote-1-32 | Comprobante de pago factura 00100001010000000231 | clientes | pago_recibido | ₡236 500 | — | pagado |
| lote-1-33 | RE: Factura 00100001010000000245 | clientes | cobro_pendiente | ₡560 000 | 2026-11-04 | vencido |
| lote-1-34 | 🔥 Black Friday: 40% en freidoras industriales | ruido | ruido | — | — | informativo |
| lote-1-35 | Boletín semanal de comercio | ruido | ruido | — | — | informativo |
| lote-1-36 | Webinar gratis: vendé más en Instagram | ruido | ruido | — | — | informativo |
| lote-1-37 | Cierre de caja 12/11/2026 · Restaurante La Fogata S.A. | ventas | cierre_ventas | ₡896 250 | — | informativo |
| lote-1-38 | Cierre de lote datáfono 12/11/2026 | ventas | cierre_datafono | ₡402 000 | — | informativo |
| lote-1-39 | Cierre de caja 13/11/2026 · Restaurante La Fogata S.A. | ventas | cierre_ventas | ₡940 350 | — | informativo |
| lote-1-40 | Cierre de lote datáfono 13/11/2026 | ventas | cierre_datafono | ₡444 100 | — | informativo |
| lote-1-41 | Cierre de caja 16/11/2026 · Restaurante La Fogata S.A. | ventas | cierre_ventas | ₡768 850 | — | informativo |
| lote-1-42 | Cierre de lote datáfono 16/11/2026 | ventas | cierre_datafono | ₡389 600 | — | informativo |
| lote-1-43 | Cierre de caja 17/11/2026 · Restaurante La Fogata S.A. | ventas | cierre_ventas | ₡866 550 | — | informativo |
| lote-1-44 | Cierre de lote datáfono 17/11/2026 | ventas | cierre_datafono | ₡367 300 | — | informativo |
| lote-1-45 | Cierre de caja 18/11/2026 · Restaurante La Fogata S.A. | ventas | cierre_ventas | ₡627 300 | — | informativo |
| lote-1-46 | Cierre de lote datáfono 18/11/2026 | ventas | cierre_datafono | ₡289 300 | — | informativo |
| lote-1-47 | Cierre de caja 19/11/2026 · Restaurante La Fogata S.A. | ventas | cierre_ventas | ₡982 100 | — | informativo |
| lote-1-48 | Cierre de lote datáfono 19/11/2026 | ventas | cierre_datafono | ₡474 600 | — | informativo |
| lote-1-49 | Nueva reserva · 20/11/2026 19:00 · 4 personas | clientes | reserva | — | — | informativo |
| lote-1-50 | Nueva reserva · 20/11/2026 20:30 · 2 personas | clientes | reserva | — | — | informativo |
| lote-1-51 | Nueva reserva · 21/11/2026 13:00 · 8 personas | clientes | reserva | — | — | informativo |
| lote-1-52 | Nueva reserva · 21/11/2026 19:30 · 14 personas | clientes | reserva | ₡50 000 | — | informativo |
| lote-1-53 | Nueva reserva · 22/11/2026 20:00 · 4 personas | clientes | reserva | — | — | informativo |
| lote-1-54 | Nueva reserva · 24/11/2026 19:00 · 3 personas | clientes | reserva | — | — | informativo |
| lote-1-55 | Nueva reserva · 27/11/2026 20:00 · 2 personas | clientes | reserva | — | — | informativo |
| lote-1-56 | Reserva cancelada · 22/11/2026 20:00 · 4 personas | clientes | reserva | — | — | informativo |
| lote-1-57 | Reserva para el domingo | clientes | reserva | — | — | informativo |
| lote-1-58 | Cena de fin de año: reserva para 20 personas | clientes | reserva | ₡100 000 | — | informativo |
| lote-1-59 | WhatsApp de Pescadería Don Jorge | proveedores | cobro | ₡96 000 | — | pendiente |
| lote-1-60 | WhatsApp de Gabriela Soto | clientes | reserva | — | — | informativo |
| lote-1-61 | WhatsApp de Hotel Vista Volcán | clientes | pago_recibido | ₡118 000 | — | pagado |
| lote-2-01 | Factura electrónica 00100001010000001003 - Distribuidora de  | proveedores | factura | ₡184 190 | 2026-12-05 | aceptado |
| lote-2-02 | Factura electrónica 00100001010000001689 - Verdulería La Hue | proveedores | factura | ₡440 700 | 2026-12-20 | aceptado |
| lote-2-03 | Nueva reserva · 20/11/2026 20:00 · 10 personas | clientes | reserva | — | — | informativo |

## Alertas esperadas

| Tipo | Confianza | Correos | Monto en riesgo | Razón |
|---|---|---|---|---|
| duplicado | alta | lote-1-03, lote-2-01 | ₡184 190 | Mismo emisor y mismo número consecutivo (misma clave numérica). *Aparece al procesar el lote 2. Es la alerta del flujo principal de la demo.* |
| duplicado | media | lote-1-10, lote-1-11 | ₡96 050 | Mismo emisor y mismo monto en 3 días, con consecutivo distinto. |
| monto_inusual | alta | lote-1-07, lote-1-04, lote-1-05, lote-1-06 | ₡416 857 | Monto ~2.8 veces el promedio de las 3 facturas anteriores de este proveedor. |
| monto_inusual | media | lote-1-19 | ₡363 577,50 | Monto ~1.8 veces el promedio de las 2 facturas anteriores. *Caso para ENSEÑAR: en la demo se marca 'Esto es normal' (o '2' en WhatsApp). Al procesar el lote 2, la factura pinar-temporada-2 NO debe alertar: queda como normal_aprendido.* |
| rechazo_hacienda | alta | lote-1-14 | ₡109 610 | El mensaje de respuesta de Hacienda dice Rechazado. |
| cobro_sin_factura | alta | lote-1-31 | ₡310 000 | Correo que pide un pago sin ninguna factura electrónica de ese emisor. |
| vencido | alta | lote-1-29 | ₡425 000 | Cuota de préstamo vencida el 15/11/2026. |
| vencido | alta | lote-1-33 | ₡560 000 | Cobro pendiente a cliente, vencido el 04/11/2026. *Es dinero POR COBRAR.* |
| cobro_sin_factura | alta | lote-1-59 | ₡96 000 | Mensaje de WhatsApp que pide un pago sin ninguna factura electrónica de ese proveedor. *Llega por el WhatsApp Business del restaurante, no por correo.* |
| cierre_descuadre | alta | lote-1-43, lote-1-44 | ₡45 000 | El cierre de caja registra ₡412 300 en ventas con tarjeta el 17/11/2026, pero el datáfono cobró ₡367 300: faltan ₡45 000. *Los otros 5 días cuadran.* |

## Revisar (confianza baja, no es alerta)

- lote-1-16: Factura sin respuesta de Hacienda (confianza baja: revisar, no alerta).

## Aprendizaje

- Marcar como normal la alerta de Verdulería La Huerta (lote 1).
- Al procesar el lote 2, **lote-2-02** no debe alertar: estado `normal_aprendido`, en gris.

## Próximos 7 días

- CCSS planilla 26/11 (₡1 248 750)
- Contador: documentos para el 25/11

## Semáforo esperado

- Después del lote 1: **rojo**
- Después del lote 2: **rojo**

## Guion de la demo con estos datos

1. Procesar el **lote 1** → semáforo rojo, bitácora y alertas (rechazo de Hacienda, cemento inusual, pintura probable, cobro sin factura, vencidos y el cierre del 17/11 que no cuadra).
2. Marcar **Verdulería La Huerta** como normal ("2" en WhatsApp).
3. Procesar el **lote 2** ("llegó un correo") → **duplicado exacto de Distribuidora de Carnes del Valle** → WhatsApp → "1" → borrador en Gmail. También llega una reserva nueva para hoy.
4. Mostrar que **lote-2-02** quedó en gris: "Normal según tu decisión".
