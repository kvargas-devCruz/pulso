-- Pulso: cierres del datáfono y del software de facturación.
-- Nueva categoría "ventas", montos leídos de un archivo (CSV) y la alerta "cierre_descuadre".
-- Los cierres se guardan en extractions.data.settlement (jsonb); no hace falta una tabla nueva.

alter table extractions drop constraint if exists extractions_category_check;
alter table extractions add constraint extractions_category_check
  check (category in ('hacienda','ccss','ins','bancos','proveedores','clientes','contador','ventas','ruido'));

alter table extractions drop constraint if exists extractions_amount_source_check;
alter table extractions add constraint extractions_amount_source_check
  check (amount_source in ('xml','archivo','ia','heuristica'));

alter table alerts drop constraint if exists alerts_type_check;
alter table alerts add constraint alerts_type_check
  check (type in ('duplicado','monto_inusual','cobro_sin_factura','rechazo_hacienda','vencido','cierre_descuadre'));

-- Nunca rechazo_hacienda (ADR-0007).
alter table learned_rules drop constraint if exists learned_rules_alert_type_check;
alter table learned_rules add constraint learned_rules_alert_type_check
  check (alert_type in ('duplicado','monto_inusual','cobro_sin_factura','vencido','cierre_descuadre'));
