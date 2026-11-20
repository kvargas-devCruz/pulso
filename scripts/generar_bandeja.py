#!/usr/bin/env python3
"""
Genera la bandeja de prueba de Pulso: "Restaurante La Fogata S.A." (empresa FICTICIA).

Salida (en data/bandeja-prueba/):
  lote-1/NN-*.json   correos que ya están en el buzón al iniciar la demo (hasta el 19/11/2026)
  lote-2/NN-*.json   correos que "llegan en vivo" durante la demo (20/11/2026)
  esperado.json      respuesta esperada (para `npm run eval`)
  resumen.md         la misma información, legible

Todo es inventado: empresas, cédulas, correos y montos. Los XML siguen de forma
SIMPLIFICADA la estructura de la factura electrónica v4.4 y del mensaje de Hacienda
(sin firma digital). Validar contra correos reales antes de dar el lector por bueno.

Uso:  python3 scripts/generar_bandeja.py
"""
import json
import os
import random
import shutil
from datetime import date, datetime, timedelta
from xml.sax.saxutils import escape as x

random.seed(20261120)  # reproducible

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "bandeja-prueba")
HOY = date(2026, 11, 20)  # "hoy" en la demo

NS_FE = "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica"
NS_MH = "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeHacienda"

EMPRESA = {
    "nombre": "Restaurante La Fogata S.A.",
    "cedula": "3101900100",
    "correo": "facturas@restaurantelafogata.test",
}

PROVEEDORES = {
    "valle":   {"nombre": "Distribuidora de Carnes del Valle S.A.", "cedula": "3101900201", "correo": "facturacion@carnesdelvalle.test",    "actividad": "463001"},
    "cemento": {"nombre": "Cervecería y Bebidas del Norte S.A.",     "cedula": "3101900202", "correo": "fe@bebidasdelnorte.test",            "actividad": "463002"},
    "pintura": {"nombre": "Lácteos La Pradera S.A.",                 "cedula": "3101900203", "correo": "facturas@lacteoslapradera.test",     "actividad": "463003"},
    "volta":   {"nombre": "Mariscos del Pacífico S.A.",              "cedula": "3101900204", "correo": "facturacion@mariscosdelpacifico.test", "actividad": "463004"},
    "tornillo":{"nombre": "Desechables Eco S.A.",                    "cedula": "3101900205", "correo": "ventas@desechableseco.test",         "actividad": "466905"},
    "pinar":   {"nombre": "Verdulería La Huerta S.A.",               "cedula": "3101900206", "correo": "facturas@verdulerialahuerta.test",   "actividad": "463005"},
    "brillo":  {"nombre": "Lavandería Mantel Blanco S.A.",           "cedula": "3101900207", "correo": "cobros@mantelblanco.test",           "actividad": "960101"},
    "contador":{"nombre": "Contadores Asociados Mora & Solís",      "cedula": "3102900208", "correo": "andrea@morasolis.test",              "actividad": "692001"},
}

consecutivos = {k: 1000 + i * 137 for i, k in enumerate(PROVEEDORES)}
correos = {"lote-1": [], "lote-2": []}
esperado = {"empresa": EMPRESA, "hoy": HOY.isoformat(), "correos": [], "alertas": [], "semaforo": {}}


def colones(n):
    t = f"{n:,.2f}".replace(",", " ").replace(".", ",")
    return "₡" + (t[:-3] if t.endswith(",00") else t)


def ts(d, hora=9, minuto=0):
    return datetime(d.year, d.month, d.day, hora, minuto).strftime("%Y-%m-%dT%H:%M:%S-06:00")


def nuevo_consecutivo(prov_key):
    consecutivos[prov_key] += 1
    # sucursal 001 + terminal 00001 + tipo 01 (factura) + número de 10 dígitos
    return f"00100001" + "01" + f"{consecutivos[prov_key]:010d}"


def clave(d, cedula, consecutivo):
    seguridad = f"{random.randint(0, 99999999):08d}"
    return "506" + d.strftime("%d%m%y") + f"{int(cedula):012d}" + consecutivo + "1" + seguridad


def xml_factura(prov, d, consecutivo, clave_num, lineas, plazo_dias):
    subtotal = sum(round(c * p, 2) for _, c, p in lineas)
    iva = round(subtotal * 0.13, 2)
    total = round(subtotal + iva, 2)
    det = []
    for i, (desc, cant, precio) in enumerate(lineas, 1):
        monto = round(cant * precio, 2)
        imp = round(monto * 0.13, 2)
        det.append(f"""    <LineaDetalle>
      <NumeroLinea>{i}</NumeroLinea>
      <CodigoCABYS>{random.randint(4000000000000, 4999999999999)}</CodigoCABYS>
      <Cantidad>{cant}</Cantidad>
      <UnidadMedida>Unid</UnidadMedida>
      <Detalle>{x(desc)}</Detalle>
      <PrecioUnitario>{precio:.2f}</PrecioUnitario>
      <MontoTotal>{monto:.2f}</MontoTotal>
      <SubTotal>{monto:.2f}</SubTotal>
      <BaseImponible>{monto:.2f}</BaseImponible>
      <Impuesto>
        <Codigo>01</Codigo>
        <CodigoTarifaIVA>08</CodigoTarifaIVA>
        <Tarifa>13.00</Tarifa>
        <Monto>{imp:.2f}</Monto>
      </Impuesto>
      <ImpuestoNeto>{imp:.2f}</ImpuestoNeto>
      <MontoTotalLinea>{monto + imp:.2f}</MontoTotalLinea>
    </LineaDetalle>""")
    xml = f"""<?xml version="1.0" encoding="utf-8"?>
<!-- FICTICIO: datos inventados para la demo de Pulso. Sin firma digital. -->
<FacturaElectronica xmlns="{NS_FE}">
  <Clave>{clave_num}</Clave>
  <ProveedorSistemas>{prov['cedula']}</ProveedorSistemas>
  <CodigoActividadEmisor>{prov['actividad']}</CodigoActividadEmisor>
  <CodigoActividadReceptor>475201</CodigoActividadReceptor>
  <NumeroConsecutivo>{consecutivo}</NumeroConsecutivo>
  <FechaEmision>{ts(d, 8, 30)}</FechaEmision>
  <Emisor>
    <Nombre>{x(prov['nombre'])}</Nombre>
    <Identificacion><Tipo>02</Tipo><Numero>{prov['cedula']}</Numero></Identificacion>
    <CorreoElectronico>{prov['correo']}</CorreoElectronico>
  </Emisor>
  <Receptor>
    <Nombre>{EMPRESA['nombre']}</Nombre>
    <Identificacion><Tipo>02</Tipo><Numero>{EMPRESA['cedula']}</Numero></Identificacion>
    <CorreoElectronico>{EMPRESA['correo']}</CorreoElectronico>
  </Receptor>
  <CondicionVenta>{'02' if plazo_dias else '01'}</CondicionVenta>
  <PlazoCredito>{plazo_dias}</PlazoCredito>
  <DetalleServicio>
{chr(10).join(det)}
  </DetalleServicio>
  <ResumenFactura>
    <CodigoTipoMoneda><CodigoMoneda>CRC</CodigoMoneda><TipoCambio>1.00000</TipoCambio></CodigoTipoMoneda>
    <TotalMercanciasGravadas>{subtotal:.2f}</TotalMercanciasGravadas>
    <TotalGravado>{subtotal:.2f}</TotalGravado>
    <TotalVenta>{subtotal:.2f}</TotalVenta>
    <TotalDescuentos>0.00</TotalDescuentos>
    <TotalVentaNeta>{subtotal:.2f}</TotalVentaNeta>
    <TotalImpuesto>{iva:.2f}</TotalImpuesto>
    <MedioPago><TipoMedioPago>04</TipoMedioPago></MedioPago>
    <TotalComprobante>{total:.2f}</TotalComprobante>
  </ResumenFactura>
</FacturaElectronica>
"""
    return xml, subtotal, iva, total


def xml_mensaje_hacienda(prov, clave_num, iva, total, aceptado, detalle):
    return f"""<?xml version="1.0" encoding="utf-8"?>
<!-- FICTICIO: respuesta de Hacienda simulada para la demo de Pulso. -->
<MensajeHacienda xmlns="{NS_MH}">
  <Clave>{clave_num}</Clave>
  <NombreEmisor>{x(prov['nombre'])}</NombreEmisor>
  <TipoIdentificacionEmisor>02</TipoIdentificacionEmisor>
  <NumeroCedulaEmisor>{prov['cedula']}</NumeroCedulaEmisor>
  <NombreReceptor>{EMPRESA['nombre']}</NombreReceptor>
  <TipoIdentificacionReceptor>02</TipoIdentificacionReceptor>
  <NumeroCedulaReceptor>{EMPRESA['cedula']}</NumeroCedulaReceptor>
  <Mensaje>{1 if aceptado else 3}</Mensaje>
  <DetalleMensaje>{x(detalle)}</DetalleMensaje>
  <MontoTotalImpuesto>{iva:.2f}</MontoTotalImpuesto>
  <TotalFactura>{total:.2f}</TotalFactura>
</MensajeHacienda>
"""


def agregar(lote, slug, correo, exp):
    n = len(correos[lote]) + 1
    cid = f"{lote}-{n:02d}"
    correo = {"id": cid, "para": EMPRESA["correo"], **correo}
    correos[lote].append((f"{n:02d}-{slug}.json", correo))
    esperado["correos"].append({"id": cid, "lote": lote, "asunto": correo["asunto"], **exp})
    return cid


def factura(lote, prov_key, d, lineas, plazo=30, hacienda="aceptado", reenvio_de=None,
            cuerpo_extra="", slug=None):
    prov = PROVEEDORES[prov_key]
    fecha_correo = d
    if reenvio_de:  # mismo documento reenviado (duplicado exacto): misma fecha de emisión y plazo
        consecutivo, clave_num, xml, subtotal, iva, total, msg, d, plazo = reenvio_de
    else:
        consecutivo = nuevo_consecutivo(prov_key)
        clave_num = clave(d, prov["cedula"], consecutivo)
        xml, subtotal, iva, total = xml_factura(prov, d, consecutivo, clave_num, lineas, plazo)
        msg = None
        if hacienda == "aceptado":
            msg = xml_mensaje_hacienda(prov, clave_num, iva, total, True, "Aceptado")
        elif hacienda == "rechazado":
            msg = xml_mensaje_hacienda(
                prov, clave_num, iva, total, False,
                "Rechazado: el código de actividad económica del receptor no coincide con el registrado en TRIBU-CR.")
    adjuntos = [{"nombre": f"FE-{consecutivo}.xml", "tipo": "application/xml", "contenido": xml},
                {"nombre": f"FE-{consecutivo}.pdf", "tipo": "application/pdf", "contenido": None,
                 "nota": "PDF omitido en la demo; el XML es la fuente de verdad."}]
    if msg:
        adjuntos.append({"nombre": f"MH-{consecutivo}.xml", "tipo": "application/xml", "contenido": msg})
    vence = d + timedelta(days=plazo)
    cuerpo = (f"Estimados señores de {EMPRESA['nombre']}:\n\n"
              f"Adjuntamos la factura electrónica N.° {consecutivo} por un total de {colones(total)}"
              f"{f', con crédito a {plazo} días (vence el {vence.strftime('%d/%m/%Y')})' if plazo else ', de contado'}.\n"
              f"{cuerpo_extra}\nSaludos cordiales,\n{prov['nombre']}")
    correo = {"remitente": f"{prov['nombre']} <{prov['correo']}>", "fecha": ts(fecha_correo, 9, random.randint(0, 59)),
              "asunto": f"Factura electrónica {consecutivo} - {prov['nombre']}", "cuerpo": cuerpo,
              "adjuntos": adjuntos}
    exp = {"categoria": "proveedores", "tipo": "factura", "contraparte": prov["nombre"],
           "numero": consecutivo, "clave": clave_num, "monto": total, "moneda": "CRC",
           "vencimiento": vence.isoformat() if plazo else None,
           "estado_hacienda": hacienda, "fuente_monto": "xml",
           "estado": "pagado (contado)" if not plazo else "pendiente"}
    cid = agregar(lote, slug or f"factura-{prov_key}", correo, exp)
    return cid, (consecutivo, clave_num, xml, subtotal, iva, total, msg, d, plazo), total


def correo_simple(lote, slug, remitente, d, asunto, cuerpo, exp, hora=10):
    return agregar(lote, slug, {"remitente": remitente, "fecha": ts(d, hora, random.randint(0, 59)),
                                "asunto": asunto, "cuerpo": cuerpo, "adjuntos": []}, exp)


def alerta(tipo, confianza, correos_rel, monto, razon, nota=None):
    a = {"tipo": tipo, "confianza": confianza, "correos": correos_rel, "monto_en_riesgo": monto, "razon": razon}
    if nota:
        a["nota"] = nota
    esperado["alertas"].append(a)


# ---------------------------------------------------------------- LOTE 1
L1 = "lote-1"
D = lambda m, d: date(2026, m, d)

# Distribuidora de Carnes del Valle: historial normal + factura que se duplicará en el lote 2
factura(L1, "valle", D(10, 15), [("Pechuga de pollo (kg)", 40, 2150), ("Chorizo artesanal (unidad)", 60, 1100)], plazo=0)
factura(L1, "valle", D(10, 29), [("Pechuga de pollo (kg)", 35, 2150), ("Chorizo artesanal (unidad)", 65, 1100)], plazo=0)
valle_orig_id, valle_doc, valle_total = factura(
    L1, "valle", D(11, 5), [("Pechuga de pollo (kg)", 40, 2150), ("Chorizo artesanal (unidad)", 70, 1100)],
    slug="factura-valle-original")

# Cervecería y Bebidas del Norte: 3 normales (~₡150 000) y una inusual (~₡420 000)
cem_ids = []
for d_, sacos in [(D(10, 8), 22), (D(10, 22), 21), (D(11, 4), 23)]:
    cid, _, _ = factura(L1, "cemento", d_, [("Caja de cerveza nacional (24 u.)", sacos, 5950)], plazo=0)
    cem_ids.append(cid)
cem_inusual_id, _, cem_inusual_total = factura(
    L1, "cemento", D(11, 17), [("Caja de cerveza nacional (24 u.)", 62, 5950)], slug="factura-cemento-inusual")

# Lácteos La Pradera: historial + posible duplicado probable (mismo monto, consecutivo distinto, 3 días)
factura(L1, "pintura", D(10, 12), [("Queso Turrialba (kg)", 12, 7300)], plazo=0)
factura(L1, "pintura", D(10, 26), [("Queso Turrialba (kg)", 10, 7300)], plazo=0)
pint_a, _, pint_total = factura(L1, "pintura", D(11, 10), [("Natilla y crema dulce (caja)", 10, 8500)],
                                slug="factura-pintura-a")
pint_b, _, _ = factura(L1, "pintura", D(11, 13), [("Natilla y crema dulce (caja)", 10, 8500)],
                       slug="factura-pintura-b-posible-duplicado")

# Mariscos del Pacífico: historial + factura RECHAZADA por Hacienda
factura(L1, "volta", D(10, 9), [("Camarón jumbo (caja 5 kg)", 4, 27500)], plazo=0)
factura(L1, "volta", D(10, 30), [("Camarón jumbo (caja 5 kg)", 3, 27500)], plazo=0)
volta_rech_id, _, volta_total = factura(
    L1, "volta", D(11, 12), [("Camarón jumbo (caja 5 kg)", 3, 27500), ("Limones (bolsa)", 10, 1450)],
    hacienda="rechazado", slug="factura-volta-rechazada")

# Desechables Eco: historial + factura SIN respuesta de Hacienda
factura(L1, "tornillo", D(10, 20), [("Empaques biodegradables para llevar (paq. 100)", 15, 3900)], plazo=0)
torn_sin_id, _, torn_total = factura(L1, "tornillo", D(11, 18), [("Empaques biodegradables para llevar (paq. 100)", 16, 3900)],
                                     hacienda="sin_respuesta", slug="factura-tornillo-sin-respuesta")

# Verdulería La Huerta: caso para ENSEÑAR (temporada)
factura(L1, "pinar", D(9, 18), [("Caja de verduras surtidas", 90, 1950)], plazo=0)
factura(L1, "pinar", D(10, 16), [("Caja de verduras surtidas", 92, 1950)], plazo=0)
pinar_t1_id, _, pinar_t1_total = factura(
    L1, "pinar", D(11, 14), [("Caja de verduras surtidas", 165, 1950)],
    cuerpo_extra="Les recordamos que en temporada navideña su pedido de verduras aumenta por las cenas de fin de año.",
    slug="factura-pinar-temporada-1")

# Lavandería Mantel Blanco: servicio mensual normal
factura(L1, "brillo", D(10, 1), [("Lavado de manteles y servilletas (mes)", 1, 84000)], plazo=0)
factura(L1, "brillo", D(11, 1), [("Lavado de manteles y servilletas (mes)", 1, 84000)], plazo=30)

# Contador: honorarios (factura) + mensajes
factura(L1, "contador", D(11, 3), [("Honorarios contables noviembre 2026", 1, 75000)], plazo=0,
        slug="factura-contador-honorarios")

cont = PROVEEDORES["contador"]
correo_simple(L1, "contador-pide-documentos", f"Andrea Mora <{cont['correo']}>", D(11, 11),
              "Documentos pendientes para el cierre de octubre",
              "Hola, doña Carmen:\n\nPara cerrar octubre necesito, a más tardar el 25 de noviembre:\n"
              "1. Estado de cuenta bancario de octubre.\n2. Comprobantes de las ventas en efectivo de octubre.\n"
              "3. La copia del permiso sanitario de funcionamiento renovado.\n\nQuedo atenta,\nAndrea Mora\nContadores Asociados Mora & Solís",
              {"categoria": "contador", "tipo": "solicitud", "contraparte": cont["nombre"], "monto": None,
               "vencimiento": "2026-11-25", "estado": "pendiente",
               "documentos_pedidos": ["estado de cuenta octubre", "comprobantes ventas efectivo octubre", "permiso sanitario renovado"]})
correo_simple(L1, "contador-iva", f"Andrea Mora <{cont['correo']}>", D(11, 13),
              "IVA de octubre presentado",
              "Hola, doña Carmen:\n\nYa presenté la declaración del IVA de octubre en TRIBU-CR. El monto a pagar fue ₡612 300 "
              "y quedó cancelado con el débito automático del 14/11. Adjunto el comprobante en el portal.\n\nSaludos,\nAndrea",
              {"categoria": "contador", "tipo": "aviso", "contraparte": cont["nombre"], "monto": 612300,
               "vencimiento": None, "estado": "pagado"})

# Hacienda
correo_simple(L1, "hacienda-recordatorio-iva", "Ministerio de Hacienda <notificaciones@hacienda.test>", D(11, 18),
              "Recordatorio: declaración del IVA de noviembre",
              "Estimado contribuyente:\n\nLe recordamos que la declaración y el pago del Impuesto al Valor Agregado "
              "(formulario 150) del período noviembre 2026 vencen el 15 de diciembre de 2026. Realice su gestión en TRIBU-CR.\n\n"
              "Este es un mensaje automático. (FICTICIO: simulado para la demo.)",
              {"categoria": "hacienda", "tipo": "aviso", "contraparte": "Ministerio de Hacienda", "monto": None,
               "vencimiento": "2026-12-15", "estado": "pendiente"})
correo_simple(L1, "hacienda-buzon", "TRIBU-CR <no-responder@hacienda.test>", D(11, 6),
              "Tiene un nuevo mensaje en su buzón de TRIBU-CR",
              "Estimado contribuyente:\n\nTiene un nuevo mensaje en su buzón de la Oficina Virtual. Ingrese a TRIBU-CR para revisarlo.\n\n"
              "(FICTICIO: simulado para la demo.)",
              {"categoria": "hacienda", "tipo": "aviso", "contraparte": "Ministerio de Hacienda", "monto": None,
               "vencimiento": None, "estado": "informativo"})

# CCSS e INS
correo_simple(L1, "ccss-planilla", "CCSS - SICERE <sicere@ccss.test>", D(11, 16),
              "Facturación de planilla noviembre 2026",
              "Patrono: Restaurante La Fogata S.A.\n\nSe generó la factura de cuotas obrero-patronales del período noviembre 2026 "
              "por ₡1 248 750. Fecha límite de pago: 26/11/2026. Evite recargos por mora.\n\n(FICTICIO: simulado para la demo.)",
              {"categoria": "ccss", "tipo": "cobro", "contraparte": "CCSS", "monto": 1248750,
               "vencimiento": "2026-11-26", "estado": "pendiente"})
correo_simple(L1, "ins-poliza", "INS Seguros <polizas@ins.test>", D(11, 9),
              "Renovación póliza de Riesgos del Trabajo",
              "Estimado cliente:\n\nSu póliza de Riesgos del Trabajo vence el 30/11/2026. El monto de la renovación es ₡182 400. "
              "Puede pagar en línea o en cualquier sede.\n\n(FICTICIO: simulado para la demo.)",
              {"categoria": "ins", "tipo": "cobro", "contraparte": "INS", "monto": 182400,
               "vencimiento": "2026-11-30", "estado": "pendiente"})

# Banco: cuota VENCIDA + estado de cuenta
banco_venc_id = correo_simple(L1, "banco-cuota-vencida", "Banco Horizonte <avisos@bancohorizonte.test>", D(11, 16),
                              "Aviso: cuota de préstamo vencida",
                              "Estimado cliente:\n\nLe informamos que la cuota N.° 18 de su préstamo comercial por ₡425 000 "
                              "venció el 15/11/2026 y no registra pago. Para evitar intereses moratorios, realice el pago a la brevedad.\n\n"
                              "(FICTICIO: simulado para la demo.)",
                              {"categoria": "bancos", "tipo": "cobro", "contraparte": "Banco Horizonte", "monto": 425000,
                               "vencimiento": "2026-11-15", "estado": "vencido"})
correo_simple(L1, "banco-estado-cuenta", "Banco Horizonte <estados@bancohorizonte.test>", D(11, 2),
              "Su estado de cuenta de octubre está disponible",
              "Estimado cliente:\n\nSu estado de cuenta de la cuenta corriente terminada en 4417, correspondiente a octubre 2026, "
              "ya está disponible en Banca en Línea.\n\n(FICTICIO: simulado para la demo.)",
              {"categoria": "bancos", "tipo": "aviso", "contraparte": "Banco Horizonte", "monto": None,
               "vencimiento": None, "estado": "informativo"})

# Cobro SIN factura
cobro_sf_id = correo_simple(L1, "cobro-sin-factura", "Hielo Polar CR <cobros@hielopolar.test>", D(11, 15),
                            "Pago pendiente hielo de noviembre",
                            "Buenas,\n\nLes escribimos para recordar el pago pendiente de ₡310 000 por el hielo entregado en noviembre. "
                            "Favor depositar a la cuenta CR00 0000 0000 0000 0000 00 (ficticia) a nombre de Hielo Polar.\n\nGracias.",
                            {"categoria": "proveedores", "tipo": "cobro", "contraparte": "Hielo Polar CR", "monto": 310000,
                             "vencimiento": None, "estado": "pendiente"})

# Clientes
correo_simple(L1, "cliente-pago-recibido", "Hotel Vista Volcán <pagos@hotelvistavolcan.test>", D(11, 12),
              "Comprobante de pago factura 00100001010000000231",
              "Hola,\n\nAdjuntamos comprobante de la transferencia SINPE por ₡236 500 correspondiente a su factura "
              "00100001010000000231 (almuerzo del congreso). Gracias.\n\nHotel Vista Volcán",
              {"categoria": "clientes", "tipo": "pago_recibido", "contraparte": "Hotel Vista Volcán", "monto": 236500,
               "vencimiento": None, "estado": "pagado"})
cliente_pend_id = correo_simple(L1, "cliente-pago-pendiente", "Eventos Corporativos Altamira <admin@eventosaltamira.test>", D(11, 14),
                                "RE: Factura 00100001010000000245",
                                "Buenas tardes,\n\nRecibimos su factura 00100001010000000245 por ₡560 000 del catering (vencía el 04/11). "
                                "Disculpen el atraso; la estaremos pagando a fin de mes.\n\nAdministración Eventos Corporativos Altamira",
                                {"categoria": "clientes", "tipo": "cobro_pendiente", "contraparte": "Eventos Corporativos Altamira",
                                 "monto": 560000, "vencimiento": "2026-11-04", "estado": "vencido",
                                 "nota": "Dinero que le DEBEN a la empresa (por cobrar), no que debe."})

# Ruido
for slug, rem, asunto in [
    ("ruido-promo-equipo", "GastroMax Ofertas <promo@gastromax.test>", "🔥 Black Friday: 40% en freidoras industriales"),
    ("ruido-boletin", "Cámara de Comercio Ficticia <boletin@camaraficticia.test>", "Boletín semanal de comercio"),
    ("ruido-webinar", "Marketing Pyme <hola@marketingpyme.test>", "Webinar gratis: vendé más en Instagram"),
]:
    correo_simple(L1, slug, rem, D(11, random.randint(3, 18)), asunto,
                  "Contenido promocional. (FICTICIO: simulado para la demo.)",
                  {"categoria": "ruido", "tipo": "ruido", "contraparte": None, "monto": None,
                   "vencimiento": None, "estado": "informativo"})

# Cierres diarios: datáfono (banco) + cierre de caja del software de facturación.
# Generador aleatorio propio para no cambiar los montos ni los IDs de lo anterior.
# Todos cuadran (tarjeta en facturación = bruto del datáfono) excepto el 17/11: faltan ₡45 000.
rng = random.Random(1711)
DATAFONO = {"nombre": "Banco Horizonte", "correo": "cierres@bancohorizonte.test"}
SOFTWARE = {"nombre": "MesaFácil POS", "correo": "cierres@mesafacil.test"}
DIA_DESCUADRE, FALTANTE = D(11, 17), 45000
cierre_ids = {}
for i, dia in enumerate([D(11, 12), D(11, 13), D(11, 16), D(11, 17), D(11, 18), D(11, 19)]):
    efectivo = rng.randrange(180, 420) * 1000 + rng.choice([0, 250, 500, 750])
    tarjeta = 412300 if dia == DIA_DESCUADRE else rng.randrange(250, 520) * 1000 + rng.choice([0, 100, 300, 600])
    sinpe = rng.randrange(60, 190) * 1000 + rng.choice([0, 500])
    total = efectivo + tarjeta + sinpe
    n_facturas = rng.randrange(28, 61)
    bruto = tarjeta - FALTANTE if dia == DIA_DESCUADRE else tarjeta
    transacciones = rng.randrange(14, 33)
    comision = round(bruto * 0.025)
    neto = bruto - comision
    lote_n = 412 + i
    f = dia.strftime("%d/%m/%Y")
    iso = dia.isoformat()

    caja_csv = ("fecha,facturas_emitidas,efectivo,tarjeta,sinpe,total\n"
                f"{iso},{n_facturas},{efectivo:.2f},{tarjeta:.2f},{sinpe:.2f},{total:.2f}\n")
    caja_id = agregar(L1, f"cierre-caja-{dia.day}", {
        "remitente": f"{SOFTWARE['nombre']} <{SOFTWARE['correo']}>", "fecha": ts(dia, 20, rng.randint(0, 59)),
        "asunto": f"Cierre de caja {f} · {EMPRESA['nombre']}",
        "cuerpo": (f"Cierre de caja del {f}.\n\nFacturas emitidas: {n_facturas}\nEfectivo: {colones(efectivo)}\n"
                   f"Tarjeta: {colones(tarjeta)}\nSINPE Móvil: {colones(sinpe)}\nTotal vendido: {colones(total)}\n\n"
                   "Detalle en el archivo adjunto.\n(FICTICIO: simulado para la demo.)"),
        "adjuntos": [{"nombre": f"cierre-caja-{iso}.csv", "tipo": "text/csv", "contenido": caja_csv}]},
        {"categoria": "ventas", "tipo": "cierre_ventas", "contraparte": SOFTWARE["nombre"], "monto": float(total),
         "moneda": "CRC", "vencimiento": None, "estado": "informativo", "fuente_monto": "archivo",
         "cierre": {"fecha": iso, "efectivo": efectivo, "tarjeta": tarjeta, "sinpe": sinpe, "total": total}})

    lote_csv = ("fecha,lote,transacciones,monto_bruto,comision,neto_depositar\n"
                f"{iso},{lote_n:04d},{transacciones},{bruto:.2f},{comision:.2f},{neto:.2f}\n")
    dat_id = agregar(L1, f"cierre-datafono-{dia.day}", {
        "remitente": f"{DATAFONO['nombre']} <{DATAFONO['correo']}>", "fecha": ts(dia, 22, rng.randint(0, 59)),
        "asunto": f"Cierre de lote datáfono {f}",
        "cuerpo": (f"Estimado comercio:\n\nEl cierre del lote {lote_n:04d} de su datáfono del {f} se procesó con éxito.\n\n"
                   f"Transacciones: {transacciones}\nMonto bruto: {colones(bruto)}\nComisión: {colones(comision)}\n"
                   f"Neto a depositar: {colones(neto)}\n\nEl depósito se acredita el siguiente día hábil.\n"
                   "(FICTICIO: simulado para la demo.)"),
        "adjuntos": [{"nombre": f"cierre-lote-{lote_n:04d}.csv", "tipo": "text/csv", "contenido": lote_csv}]},
        {"categoria": "ventas", "tipo": "cierre_datafono", "contraparte": DATAFONO["nombre"], "monto": float(bruto),
         "moneda": "CRC", "vencimiento": None, "estado": "informativo", "fuente_monto": "archivo",
         "cierre": {"fecha": iso, "tarjeta": bruto, "comision": comision, "neto": neto}})
    cierre_ids[dia] = (caja_id, dat_id)

# Reservas: plataforma ficticia "ReservaYa" (con .ics) y clientes que escriben directo (solo texto).
# Al final del lote 1 para no cambiar los IDs anteriores. Una se cancela; dos directas quedan por confirmar.
PLATAFORMA = {"nombre": "ReservaYa", "correo": "reservas@reservaya.test"}


def ics(codigo, d, hora, minuto, nombre, personas, telefono, notas, anticipo, estado="CONFIRMED"):
    desc = f"Personas: {personas}\\nTeléfono: {telefono}\\nNotas: {notas or '-'}\\nAnticipo: {anticipo or 0}"
    return ("BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//ReservaYa//ES\nMETHOD:PUBLISH\nBEGIN:VEVENT\n"
            f"UID:{codigo}@reservaya.test\n"
            f"DTSTART;TZID=America/Costa_Rica:{d.strftime('%Y%m%d')}T{hora:02d}{minuto:02d}00\n"
            f"SUMMARY:Reserva {nombre} · {personas} personas\n"
            f"X-PARTY-SIZE:{personas}\n"
            f"DESCRIPTION:{desc}\n"
            f"STATUS:{estado}\nEND:VEVENT\nEND:VCALENDAR\n")


def reserva(lote, codigo, recibido, d, hora, minuto, nombre, personas, notas=None, anticipo=None, cancelada=False):
    f = d.strftime("%d/%m/%Y")
    hh = f"{hora:02d}:{minuto:02d}"
    tel = "8800-0000 (ficticio)"
    asunto = (f"Reserva cancelada · {f} {hh} · {personas} personas" if cancelada
              else f"Nueva reserva · {f} {hh} · {personas} personas")
    cuerpo = ((f"La reserva {codigo} fue cancelada por el cliente.\n\n" if cancelada
               else f"Tenés una nueva reserva confirmada en {EMPRESA['nombre']}:\n\n")
              + f"Nombre: {nombre}\nPersonas: {personas}\nFecha: {f}\nHora: {hh}\nTeléfono: {tel}\n"
              + (f"Notas: {notas}\n" if notas else "")
              + (f"Anticipo: {colones(anticipo)}\n" if anticipo else "")
              + f"Código: {codigo}\n\n(FICTICIO: simulado para la demo.)")
    return agregar(lote, f"reserva-{codigo.lower()}{'-cancelada' if cancelada else ''}", {
        "remitente": f"{PLATAFORMA['nombre']} <{PLATAFORMA['correo']}>", "fecha": ts(recibido, 11, rrng.randint(0, 59)),
        "asunto": asunto, "cuerpo": cuerpo,
        "adjuntos": [{"nombre": f"reserva-{codigo}.ics", "tipo": "text/calendar",
                      "contenido": ics(codigo, d, hora, minuto, nombre, personas, tel, notas, anticipo,
                                       "CANCELLED" if cancelada else "CONFIRMED")}]},
        {"categoria": "clientes", "tipo": "reserva", "contraparte": nombre, "monto": float(anticipo) if anticipo else None,
         "moneda": "CRC", "vencimiento": None, "estado": "informativo", "fuente_monto": "archivo" if anticipo else None,
         "reserva": {"codigo": codigo, "fecha": d.isoformat(), "hora": hh, "personas": personas,
                     "estado": "cancelada" if cancelada else "confirmada", "anticipo": anticipo}})


rrng = random.Random(2011)
reserva(L1, "RY-48201", D(11, 15), D(11, 20), 19, 0, "Ana Vargas", 4)
reserva(L1, "RY-48207", D(11, 16), D(11, 20), 20, 30, "Carlos Jiménez", 2, notas="Aniversario, mesa tranquila")
reserva(L1, "RY-48212", D(11, 16), D(11, 21), 13, 0, "Familia Rojas", 8, notas="Silla para bebé")
reserva(L1, "RY-48213", D(11, 17), D(11, 21), 19, 30, "María Solano", 14, notas="Cumpleaños, terraza", anticipo=50000)
reserva(L1, "RY-48220", D(11, 17), D(11, 22), 20, 0, "Pedro Mora", 4)
reserva(L1, "RY-48224", D(11, 18), D(11, 24), 19, 0, "Sofía Castro", 3)
reserva(L1, "RY-48231", D(11, 19), D(11, 27), 20, 0, "Laura Méndez", 2, notas="Alergia a los mariscos")
reserva(L1, "RY-48220", D(11, 19), D(11, 22), 20, 0, "Pedro Mora", 4, cancelada=True)
correo_simple(L1, "reserva-directa-familia", "Luis Fernández <luisf@correo.test>", D(11, 18),
              "Reserva para el domingo",
              "Hola, buenas.\n\nQuisiera reservar mesa para 8 personas el domingo 22/11/2026 a las 12:30. "
              "Es un almuerzo familiar.\n\nMuchas gracias,\nLuis Fernández\n(FICTICIO: simulado para la demo.)",
              {"categoria": "clientes", "tipo": "reserva", "contraparte": "Luis Fernández", "monto": None,
               "vencimiento": None, "estado": "informativo",
               "reserva": {"fecha": "2026-11-22", "hora": "12:30", "personas": 8, "estado": "por_confirmar"}})
correo_simple(L1, "reserva-directa-empresa", "Datacorp CR <eventos@datacorp.test>", D(11, 19),
              "Cena de fin de año: reserva para 20 personas",
              "Buenas tardes:\n\nQueremos reservar para 20 personas el jueves 26/11/2026 a las 18:30 para nuestra cena "
              "de fin de año. Podemos dejar un adelanto de ₡100 000.\n\nSaludos,\nRecursos Humanos, Datacorp CR\n"
              "(FICTICIO: simulado para la demo.)",
              {"categoria": "clientes", "tipo": "reserva", "contraparte": "Datacorp CR", "monto": 100000,
               "vencimiento": None, "estado": "informativo",
               "reserva": {"fecha": "2026-11-26", "hora": "18:30", "personas": 20, "estado": "por_confirmar", "anticipo": 100000}})

# ---------------------------------------------------------------- LOTE 2 (llega en vivo)
L2 = "lote-2"
valle_dup_id, _, _ = factura(
    L2, "valle", D(11, 20), None, reenvio_de=valle_doc,
    cuerpo_extra="Reenviamos la factura por si no la recibieron.", slug="factura-valle-REENVIO-duplicado")
pinar_t2_id, _, pinar_t2_total = factura(
    L2, "pinar", D(11, 20), [("Caja de verduras surtidas", 200, 1950)],
    cuerpo_extra="Segundo pedido de temporada navideña.", slug="factura-pinar-temporada-2")

reserva_hoy_id = reserva(L2, "RY-48240", D(11, 20), D(11, 20), 20, 0, "Andrés Quesada", 10, notas="Despedida de soltero")

# ---------------------------------------------------------------- ALERTAS ESPERADAS
alerta("duplicado", "alta", [valle_orig_id, valle_dup_id], valle_total,
       "Mismo emisor y mismo número consecutivo (misma clave numérica).",
       "Aparece al procesar el lote 2. Es la alerta del flujo principal de la demo.")
alerta("duplicado", "media", [pint_a, pint_b], pint_total,
       "Mismo emisor y mismo monto en 3 días, con consecutivo distinto.")
alerta("monto_inusual", "alta", [cem_inusual_id] + cem_ids, cem_inusual_total,
       "Monto ~2.8 veces el promedio de las 3 facturas anteriores de este proveedor.")
alerta("monto_inusual", "media", [pinar_t1_id], pinar_t1_total,
       "Monto ~1.8 veces el promedio de las 2 facturas anteriores.",
       "Caso para ENSEÑAR: en la demo se marca 'Esto es normal' (o '2' en WhatsApp). "
       "Al procesar el lote 2, la factura pinar-temporada-2 NO debe alertar: queda como normal_aprendido.")
alerta("rechazo_hacienda", "alta", [volta_rech_id], volta_total,
       "El mensaje de respuesta de Hacienda dice Rechazado.")
alerta("cobro_sin_factura", "alta", [cobro_sf_id], 310000,
       "Correo que pide un pago sin ninguna factura electrónica de ese emisor.")
alerta("vencido", "alta", [banco_venc_id], 425000, "Cuota de préstamo vencida el 15/11/2026.")
alerta("vencido", "alta", [cliente_pend_id], 560000,
       "Cobro pendiente a cliente, vencido el 04/11/2026.", "Es dinero POR COBRAR.")
alerta("cierre_descuadre", "alta", list(cierre_ids[DIA_DESCUADRE]), FALTANTE,
       "El cierre de caja registra ₡412 300 en ventas con tarjeta el 17/11/2026, pero el datáfono cobró ₡367 300: faltan ₡45 000.",
       "Los otros 5 días cuadran.")
esperado["revisar"] = [{"correo": torn_sin_id, "razon": "Factura sin respuesta de Hacienda (confianza baja: revisar, no alerta)."}]
esperado["sin_alerta_si_se_enseno"] = [{"correo": pinar_t2_id, "estado": "normal_aprendido"}]
esperado["proximos_7_dias"] = ["CCSS planilla 26/11 (₡1 248 750)", "Contador: documentos para el 25/11"]
esperado["semaforo"] = {"despues_lote_1": "rojo", "despues_lote_2": "rojo",
                        "frase_ejemplo": "Tenés 2 pagos vencidos y 4 cobros que no cuadran."}

# ---------------------------------------------------------------- ESCRIBIR
if os.path.isdir(OUT):
    for sub in ("lote-1", "lote-2"):
        shutil.rmtree(os.path.join(OUT, sub), ignore_errors=True)
for lote, items in correos.items():
    os.makedirs(os.path.join(OUT, lote), exist_ok=True)
    for nombre, c in items:
        with open(os.path.join(OUT, lote, nombre), "w", encoding="utf-8") as f:
            json.dump(c, f, ensure_ascii=False, indent=2)

with open(os.path.join(OUT, "esperado.json"), "w", encoding="utf-8") as f:
    json.dump(esperado, f, ensure_ascii=False, indent=2)

# resumen.md legible
lineas = ["# Bandeja de prueba: Restaurante La Fogata S.A. (FICTICIA)", "",
          f"Hoy en la demo: **{HOY.strftime('%d/%m/%Y')}**. Generada con `scripts/generar_bandeja.py` (reproducible).",
          "Todo es inventado. Los XML siguen de forma simplificada la factura electrónica v4.4 y el mensaje de Hacienda, sin firma digital.",
          "", f"- Lote 1 (ya en el buzón): **{len(correos['lote-1'])} correos**",
          f"- Lote 2 (llegan en vivo durante la demo): **{len(correos['lote-2'])} correos**", "",
          "## Correos y lo que se debe extraer", "",
          "| ID | Asunto | Categoría | Tipo | Monto | Vence | Estado / Hacienda |", "|---|---|---|---|---|---|---|"]
for c in esperado["correos"]:
    monto = colones(c["monto"]) if c.get("monto") else "—"
    estado = c.get("estado_hacienda") or c.get("estado") or ""
    lineas.append(f"| {c['id']} | {c['asunto'][:60]} | {c['categoria']} | {c['tipo']} | {monto} | {c.get('vencimiento') or '—'} | {estado} |")
lineas += ["", "## Alertas esperadas", "", "| Tipo | Confianza | Correos | Monto en riesgo | Razón |", "|---|---|---|---|---|"]
for a in esperado["alertas"]:
    lineas.append(f"| {a['tipo']} | {a['confianza']} | {', '.join(a['correos'])} | {colones(a['monto_en_riesgo'])} | {a['razon']}"
                  + (f" *{a['nota']}*" if a.get("nota") else "") + " |")
lineas += ["", "## Revisar (confianza baja, no es alerta)", ""]
lineas += [f"- {r['correo']}: {r['razon']}" for r in esperado["revisar"]]
lineas += ["", "## Aprendizaje", "", "- Marcar como normal la alerta de Verdulería La Huerta (lote 1).",
           f"- Al procesar el lote 2, **{pinar_t2_id}** no debe alertar: estado `normal_aprendido`, en gris.", "",
           "## Próximos 7 días", ""] + [f"- {p}" for p in esperado["proximos_7_dias"]]
lineas += ["", "## Semáforo esperado", "",
           f"- Después del lote 1: **{esperado['semaforo']['despues_lote_1']}**",
           f"- Después del lote 2: **{esperado['semaforo']['despues_lote_2']}**",
           "", "## Guion de la demo con estos datos", "",
           "1. Procesar el **lote 1** → semáforo rojo, bitácora y alertas (rechazo de Hacienda, cemento inusual, pintura probable, cobro sin factura, vencidos y el cierre del 17/11 que no cuadra).",
           "2. Marcar **Verdulería La Huerta** como normal (\"2\" en WhatsApp).",
           "3. Procesar el **lote 2** (\"llegó un correo\") → **duplicado exacto de Distribuidora de Carnes del Valle** → WhatsApp → \"1\" → borrador en Gmail. También llega una reserva nueva para hoy.",
           f"4. Mostrar que **{pinar_t2_id}** quedó en gris: \"Normal según tu decisión\"."]
with open(os.path.join(OUT, "resumen.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(lineas) + "\n")

print(f"Lote 1: {len(correos['lote-1'])} correos · Lote 2: {len(correos['lote-2'])} correos · "
      f"Alertas esperadas: {len(esperado['alertas'])}")
