# PRD: Pulso

**Producto:** Pulso, el estado de tu empresa, leído de tu correo.
**Equipo:** WildDogs (Kevin Cruz)
**Evento:** Dojo AI Hackathon, Track 02: Build for Business (20–22 nov 2026)
**Estado:** alcance congelado el 19/11/2026

---

## 1. Problema
El correo de una pyme costarricense recibe cada semana facturas electrónicas de proveedores, avisos de Hacienda/TRIBU-CR, cobros de la CCSS y el INS, mensajes del contador, estados de cuenta y cobros de clientes. El dueño no tiene tiempo de revisarlo con calma, y ahí se pierde plata:
- vencimientos enterrados en un correo,
- facturas duplicadas o cobros más altos de lo normal que nadie compara,
- facturas rechazadas por Hacienda que ya no sirven como gasto,
- cobros sin factura que los respalde.

El sistema contable (si lo hay) solo sabe lo que alguien ya registró. Nadie vigila lo que **está llegando**.

## 2. Para quién
**Cliente inicial:** pymes de 2 a 30 colaboradores en Costa Rica (empezando por restaurantes y comercios) que reciben facturas por correo, trabajan con un contador externo y no tienen un departamento financiero.
**Usuario:** el dueño o administrador. No es contador ni técnico. Vive en WhatsApp.

## 3. Propuesta de valor
*"Alegra administra lo que ya registraste. Pulso vigila lo que está llegando a tu empresa."*
- Funciona con cualquier sistema contable, o sin ninguno. No hay que migrar nada.
- Detecta riesgos **con evidencia** y prepara la acción; el dueño decide.
- Avisa por WhatsApp, donde el dueño ya está.

## 4. Flujo principal (el producto)
1. Llega una factura al correo.
2. Pulso la identifica y extrae sus datos.
3. Encuentra otra factura que es un **posible** duplicado.
4. Muestra ambos documentos lado a lado, con nivel de confianza y razón.
5. Envía una alerta por WhatsApp.
6. El dueño responde "1".
7. Se guarda un borrador en Gmail para resolverlo. Nada se envía solo.

Este flujo tiene que funcionar de principio a fin, siempre. Todo lo demás es complemento.

## 5. Requerimientos funcionales

### Núcleo
- **R1. Ingesta por adaptadores:** bandeja demo (archivos JSON) y Gmail (OAuth, solo lectura). Ambos entregan el mismo formato al motor.
- **R2. Extracción:** XML de factura electrónica con código (montos exactos); PDF e imágenes con la visión de Claude; correos sin adjunto con Claude. Campos dudosos marcados.
- **R3. Estado en Hacienda:** leer el mensaje de respuesta de Hacienda (Aceptado / Rechazado) y relacionarlo por clave numérica. Sin respuesta → "revisar".
- **R4. Clasificación:** Hacienda · CCSS · INS · Bancos · Proveedores · Clientes · Contador · Ruido.
- **R5. Trazabilidad:** todo dato del panel abre el correo y el documento de origen.

### Inteligencia (reglas de código; la IA solo explica)
- **R6. Posibles duplicados:** exacto (mismo consecutivo, confianza alta) o probable (mismo emisor y monto, fechas cercanas, confianza media).
- **R7. Montos inusuales:** factura muy por encima del promedio histórico del proveedor; se muestra el historial usado.
- **R8. Cobro sin factura:** correo que pide un pago sin XML que lo respalde.
- **R9. Rechazo de Hacienda:** alerta de confianza alta con borrador al proveedor.
- **R10. Vencimientos:** pagos vencidos y próximos a vencer (7 días); cobros pendientes.
- **R11. Semáforo:** rojo (algo vencido o alerta grave), amarillo (vence en 7 días o alerta leve), verde (al día). Con frase, montos y enlaces.
- **R12. Nivel de confianza:** alta / media / baja (baja = "revisar", nunca alerta).
- **R13. Aprende de tus decisiones:** "Esto es normal" (panel o "2" en WhatsApp) crea una regla aprendida por proveedor y tipo de alerta; los casos iguales se muestran en gris sin alertar. Las reglas se pueden ver y borrar. **Nunca** se aprende a ignorar un rechazo de Hacienda.

### Acción
- **R14. Evidencia lado a lado** en cada alerta: documentos, campos, regla aplicada, confianza y fecha de análisis.
- **R15. Borradores con aprobación:** correo al proveedor, cobro al cliente o recordatorio. Se aprueba desde el panel o con "1" en WhatsApp y se guarda como borrador en Gmail.
- **R16. WhatsApp:** alertas al instante (confianza alta o media), respuestas "1" / "2" / "VER", resumen "Tu semana". Sin spam: agrupación y tope diario.
- **R17. Bitácora del agente:** lo que hizo Pulso en cada procesamiento, visible arriba del panel.
- **R18. Tu semana:** plan priorizado por urgencia, monto y fecha, con la razón.
- **R19. Cierre mensual para el contador:** facturas (con estado en Hacienda), gastos, ingresos, pendientes, anomalías y solicitudes del contador.
- **R20. Dinero en riesgo:** monto en juego en alertas abiertas. "Evitado" o "recuperado" solo cuando el dueño lo confirma.
- **R21. Preguntarle al panel:** respuestas en lenguaje natural que citan la fuente.

## 6. Requerimientos no funcionales
- **Confianza:** la IA nunca inventa montos ni fechas. Montos y estado de Hacienda salen del XML con código.
- **Privacidad:** permisos mínimos (Gmail solo lectura + borradores), datos aislados por empresa, opción de borrar todo, los WhatsApp solo llevan resumen y link.
- **Idioma:** español de Costa Rica (voseo), colones con formato ₡185 400.
- **Lenguaje cuidadoso:** "posible duplicado", "monto fuera de lo normal". Nunca "fraude".
- **Demo reproducible:** el flujo principal corre 5 veces seguidas sin fallar sobre la bandeja demo.

## 7. Fuera de alcance
Pagos, presentar declaraciones, contabilidad completa, facturación propia, inventario, planillas, varias empresas por usuario, app móvil, envío de correos sin aprobación, integración en tiempo real con bancos o SINPE.

## 8. Métricas de éxito (hackathon)
- % de correos clasificados correctamente en la bandeja demo (contra `resumen.md`).
- Precisión de extracción de monto, fecha, emisor y número.
- Alertas plantadas detectadas y falsos positivos.
- Prueba con correos reales de un restaurante (usuario real).
- Las métricas de ahorro de tiempo se presentan como estimaciones, nunca como hechos.

## 9. Riesgos
| Riesgo | Mitigación |
|---|---|
| OAuth de Gmail se traba | La bandeja demo es un adaptador completo; Gmail real va el domingo. |
| WhatsApp falla en vivo | Video de respaldo de la demo. |
| Falsos positivos | Nivel de confianza, "revisar" para casos dudosos y reglas aprendidas. |
| Formato real del XML de Hacienda distinto al supuesto | Validar con correos reales antes de escribir el lector. |
| Competencia (Alegra Bot, Buzón Inteligente) | Diferenciador: todo el correo, cualquier sistema, WhatsApp con aprobación, aprendizaje. |

## 10. Modelo de negocio
Suscripción mensual por empresa. Planes: monitoreo básico · detección avanzada + WhatsApp · reportes para el contador. Precio por validar con un piloto de 3 a 5 negocios.
