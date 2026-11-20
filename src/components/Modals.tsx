"use client";
import { useEffect, useState } from "react";
import type { PulsoState } from "@/lib/state";
import type { EmailRecord, Extraction } from "@/lib/types";
import { Badge, Button, Modal, colones, fecha } from "./ui";

type AlertView = PulsoState["alerts"][number];
interface EmailWithExt { email: EmailRecord; extraction: Extraction | null }

function useEmails(ids: string[]) {
  const [data, setData] = useState<Record<string, EmailWithExt>>({});
  const key = ids.join(",");
  useEffect(() => {
    let alive = true;
    Promise.all(key.split(",").filter(Boolean).map((id) => fetch(`/api/emails/${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => r.json())))
      .then((list: EmailWithExt[]) => { if (alive) setData(Object.fromEntries(list.filter((x) => x.email).map((x) => [x.email.id, x]))); });
    return () => { alive = false; };
  }, [key]);
  return data;
}

const short = (s: string | undefined, n = 10) => (s ? (s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-n)}` : s) : "—");

export function EvidenceModal({ alert, onClose, onOpenEmail }: { alert: AlertView; onClose: () => void; onOpenEmail: (id: string) => void }) {
  const ids = alert.type === "monto_inusual" ? alert.emailIds.slice(0, 1) : alert.emailIds.slice(0, 2);
  const emails = useEmails(ids);
  const main = emails[alert.emailIds[0]];

  return (
    <Modal open onClose={onClose} title={`Evidencia · ${alert.title}`} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={alert.confidence === "alta" ? "red" : alert.confidence === "media" ? "amber" : "gray"}>confianza {alert.confidence}</Badge>
        <span className="text-muted">Regla: <code className="font-mono text-xs">{alert.ruleApplied}</code></span>
        <span className="text-muted">· analizado el {fecha(alert.analyzedAt)}</span>
        {alert.status === "normal_aprendido" && <Badge tone="gray">normal según tu decisión</Badge>}
      </div>
      <p className="mb-4 rounded-xl bg-stone-50 p-3 text-sm"><strong>Por qué:</strong> {alert.reason}</p>

      {alert.type === "duplicado" && (
        <div className="grid gap-3 md:grid-cols-2">
          {ids.map((id, i) => {
            const e = emails[id];
            const inv = e?.extraction?.invoice;
            const other = emails[ids[1 - i]]?.extraction?.invoice;
            const same = (a?: string | number, b?: string | number) => a !== undefined && a === b;
            const Row = ({ label, value, match }: { label: string; value: string; match?: boolean }) => (
              <div className={`flex justify-between gap-3 rounded-md px-2 py-1 ${match ? "bg-red-soft" : ""}`}>
                <dt className="text-muted">{label}</dt><dd className="text-right font-medium tabular">{value}{match ? " =" : ""}</dd>
              </div>
            );
            return (
              <div key={id} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Correo {i + 1}</span>
                  <Button variant="ghost" onClick={() => onOpenEmail(id)}>Abrir correo</Button>
                </div>
                {inv ? (
                  <dl className="space-y-0.5 text-sm">
                    <Row label="Recibido" value={fecha(e.email.receivedAt)} />
                    <Row label="Emisor" value={inv.issuerName} match={same(inv.issuerTaxId, other?.issuerTaxId)} />
                    <Row label="N.° consecutivo" value={inv.docNumber} match={same(inv.docNumber, other?.docNumber)} />
                    <Row label="Clave" value={short(inv.numericKey)} match={same(inv.numericKey, other?.numericKey)} />
                    <Row label="Emitida" value={fecha(inv.issuedAt)} match={same(inv.issuedAt.slice(0, 10), other?.issuedAt.slice(0, 10))} />
                    <Row label="Total" value={colones(inv.total)} match={same(inv.total, other?.total)} />
                  </dl>
                ) : <p className="text-sm text-muted">Cargando…</p>}
              </div>
            );
          })}
          <p className="text-xs text-muted md:col-span-2">En rojo: los datos que coinciden entre los dos correos.</p>
        </div>
      )}

      {alert.type === "monto_inusual" && (
        <History alert={alert} current={main?.extraction?.invoice?.total ?? null} currentDate={main?.extraction?.invoice?.issuedAt ?? null} />
      )}

      {alert.type === "rechazo_hacienda" && (
        <div className="rounded-xl border border-line p-3 text-sm">
          <p><strong>Respuesta de Hacienda:</strong> {String(alert.meta.detail ?? "Rechazado")}</p>
          <p className="mt-1 text-muted">Factura N.° {String(alert.meta.docNumber ?? "")} · {colones(alert.amountAtRisk)}. Leído del XML de respuesta de Hacienda que vino con la factura.</p>
        </div>
      )}

      {alert.type === "cierre_descuadre" && (
        <div className="grid gap-3 md:grid-cols-2">
          {ids.map((id) => {
            const e = emails[id];
            const st = e?.extraction?.settlement;
            const Row = ({ label, value, hl }: { label: string; value: string; hl?: boolean }) => (
              <div className={`flex justify-between gap-3 rounded-md px-2 py-1 ${hl ? "bg-red-soft font-semibold" : ""}`}>
                <dt className={hl ? "" : "text-muted"}>{label}</dt><dd className="text-right tabular">{value}</dd>
              </div>
            );
            return (
              <div key={id} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{st?.source === "datafono" ? "Cierre del datáfono" : "Cierre de caja"} · {e?.extraction?.counterparty ?? ""}</span>
                  <Button variant="ghost" onClick={() => onOpenEmail(id)}>Abrir correo</Button>
                </div>
                {st ? (
                  <dl className="space-y-0.5 text-sm">
                    <Row label="Fecha" value={fecha(st.date)} />
                    {st.source === "datafono" ? (
                      <>
                        {st.batch && <Row label="Lote" value={st.batch} />}
                        {st.transactions !== null && <Row label="Transacciones" value={String(st.transactions)} />}
                        <Row label="Cobrado con tarjeta" value={colones(st.card)} hl />
                        {st.commission !== null && <Row label="Comisión" value={colones(st.commission)} />}
                        {st.deposit !== null && <Row label="Neto a depositar" value={colones(st.deposit)} />}
                      </>
                    ) : (
                      <>
                        {st.invoices !== null && <Row label="Facturas emitidas" value={String(st.invoices)} />}
                        <Row label="Efectivo" value={colones(st.cash)} />
                        <Row label="Ventas con tarjeta" value={colones(st.card)} hl />
                        <Row label="SINPE Móvil" value={colones(st.sinpe)} />
                        <Row label="Total vendido" value={colones(st.total)} />
                      </>
                    )}
                    <p className="pt-1 text-xs text-muted">{st.fromFile ? "Leído del archivo CSV adjunto (exacto)." : "Leído del texto del correo: confirmalo."}</p>
                  </dl>
                ) : <p className="text-sm text-muted">Cargando…</p>}
              </div>
            );
          })}
          <div className="rounded-xl bg-red-soft p-3 text-sm md:col-span-2">
            <strong>Diferencia: {colones(alert.amountAtRisk)}</strong>
            {alert.meta.direction === "faltante" ? " que el datáfono no cobró." : " cobrados con tarjeta sin factura en el cierre de caja."}
            <span className="text-muted"> En rojo: la línea que se compara (ventas con tarjeta).</span>
          </div>
        </div>
      )}

      {(alert.type === "cobro_sin_factura" || alert.type === "vencido") && main && (
        <div className="rounded-xl border border-line p-3 text-sm">
          <div className="mb-1 text-muted">{main.email.sender} · {fecha(main.email.receivedAt)}</div>
          <div className="font-medium">{main.email.subject}</div>
          <p className="mt-2 whitespace-pre-wrap">{main.email.body}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {alert.emailIds.slice(0, alert.type === "monto_inusual" ? 1 : 2).map((id, i) => (
          <Button key={id} onClick={() => onOpenEmail(id)}>Abrir correo {alert.emailIds.length > 1 && alert.type !== "monto_inusual" ? i + 1 : "original"}</Button>
        ))}
      </div>
    </Modal>
  );
}

function History({ alert, current, currentDate }: { alert: AlertView; current: number | null; currentDate: string | null }) {
  const hist = (alert.meta.history as { date: string; total: number; docNumber: string }[] | undefined) ?? [];
  const avg = Number(alert.meta.average ?? 0);
  const rows = [...hist.map((h) => ({ ...h, now: false })), ...(current !== null ? [{ date: (currentDate ?? "").slice(0, 10), total: current, docNumber: "", now: true }] : [])];
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="mb-3 text-sm">Historial de facturas de <strong>{alert.counterparty}</strong> · promedio {colones(avg)} · esta es <strong>{Number(alert.meta.ratio).toFixed(1)}×</strong> el promedio.</p>
      <ul className="space-y-2" aria-label="Historial de montos del proveedor">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[80px_1fr_110px] items-center gap-3 text-sm">
            <span className="text-muted">{fecha(r.date)}</span>
            <span className="h-4 rounded bg-stone-100">
              <span className={`block h-4 rounded ${r.now ? "bg-red" : "bg-stone-400"}`} style={{ width: `${Math.max(4, (r.total / max) * 100)}%` }} />
            </span>
            <span className={`text-right tabular ${r.now ? "font-semibold text-red" : ""}`}>{colones(r.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmailModal({ emailId, onClose }: { emailId: string; onClose: () => void }) {
  const data = useEmails([emailId])[emailId];
  const [showXml, setShowXml] = useState(false);
  const x = data?.extraction;
  return (
    <Modal open onClose={onClose} title={data?.email.subject ?? "Correo"}>
      {!data ? <p className="text-sm text-muted">Cargando…</p> : (
        <div className="space-y-4 text-sm">
          <div className="text-muted">{data.email.sender} · {new Date(data.email.receivedAt).toLocaleString("es-CR")}</div>
          <p className="whitespace-pre-wrap rounded-xl bg-stone-50 p-3">{data.email.body}</p>
          {data.email.attachments.length > 0 && (
            <div>
              <div className="mb-1 font-medium">Adjuntos</div>
              <ul className="flex flex-wrap gap-2">
                {data.email.attachments.map((a) => <li key={a.name}><Badge>{a.name}</Badge></li>)}
              </ul>
              {data.email.attachments.some((a) => a.content) && (
                <button className="mt-2 text-xs underline" onClick={() => setShowXml((v) => !v)}>{showXml ? "Ocultar XML" : "Ver XML"}</button>
              )}
              {showXml && data.email.attachments.filter((a) => a.content).map((a) => (
                <pre key={a.name} className="mt-2 max-h-64 overflow-auto rounded-lg bg-ink p-3 text-[11px] text-stone-100">{a.content}</pre>
              ))}
            </div>
          )}
          {x && (
            <div className="rounded-xl border border-line p-3">
              <div className="mb-2 font-medium">Lo que entendió Pulso</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-muted">Categoría</dt><dd>{x.category}</dd>
                <dt className="text-muted">Tipo</dt><dd>{x.kind}</dd>
                <dt className="text-muted">Monto</dt><dd className="tabular">{colones(x.amount)} {x.amountSource && <span className="text-xs text-muted">({x.amountSource === "xml" ? "del XML" : x.amountSource === "ia" ? "leído por IA" : "leído del texto"})</span>}</dd>
                <dt className="text-muted">Vence</dt><dd>{fecha(x.dueDate)}</dd>
                <dt className="text-muted">Estado</dt><dd>{x.status}</dd>
                {x.haciendaStatus && <><dt className="text-muted">Hacienda</dt><dd>{x.haciendaStatus}{x.haciendaDetail ? ` · ${x.haciendaDetail}` : ""}</dd></>}
                {x.requestedDocuments.length > 0 && <><dt className="text-muted">Documentos pedidos</dt><dd>{x.requestedDocuments.join(" · ")}</dd></>}
              </dl>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function DraftModal({ alert, onClose }: { alert: AlertView; onClose: () => void }) {
  const a = alert.action;
  const [copied, setCopied] = useState(false);
  return (
    <Modal open onClose={onClose} title="Correo preparado">
      {!a ? <p className="text-sm text-muted">Preparando…</p> : (
        <div className="space-y-3 text-sm">
          <p className="rounded-xl bg-green-soft p-3 text-green">No envié nada. Revisalo y envialo vos desde tu correo{a.approvedVia === "whatsapp" ? " (lo aprobaste por WhatsApp)" : ""}.</p>
          {a.to && <div><span className="text-muted">Para:</span> {a.to}</div>}
          <div><span className="text-muted">Asunto:</span> {a.subject}</div>
          <pre className="whitespace-pre-wrap rounded-xl border border-line bg-stone-50 p-3 font-sans">{a.draft}</pre>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => { navigator.clipboard?.writeText(`${a.subject}\n\n${a.draft}`); setCopied(true); }}>{copied ? "Copiado ✓" : "Copiar"}</Button>
            {a.to && <a className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-sm font-medium hover:bg-stone-50" href={`mailto:${a.to}?subject=${encodeURIComponent(a.subject)}&body=${encodeURIComponent(a.draft)}`}>Abrir en mi correo</a>}
          </div>
          <p className="text-xs text-muted">Con Gmail conectado, este borrador queda guardado directamente en tus borradores de Gmail.</p>
        </div>
      )}
    </Modal>
  );
}
