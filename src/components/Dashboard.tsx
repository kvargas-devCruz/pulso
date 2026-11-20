"use client";
import { useCallback, useEffect, useState } from "react";
import type { PulsoState } from "@/lib/state";
import { Badge, Button, Card, PulseIcon, SectionTitle, colones, fecha, type Tone } from "./ui";
import { EvidenceModal, EmailModal, DraftModal } from "./Modals";
import { Phone } from "./Phone";
import { CATEGORY_COLOR, Donut, STATUS_COLOR, colonesShort } from "./Charts";

type AlertView = PulsoState["alerts"][number];
type DocView = PulsoState["documents"][number];

const LIGHT = {
  rojo: { dot: "bg-red", soft: "bg-red-soft", text: "text-red", label: "Rojo" },
  amarillo: { dot: "bg-amber", soft: "bg-amber-soft", text: "text-amber", label: "Amarillo" },
  verde: { dot: "bg-green", soft: "bg-green-soft", text: "text-green", label: "Verde" },
} as const;

const confTone = (c: string): Tone => (c === "alta" ? "red" : c === "media" ? "amber" : "gray");
const haciendaTone = (s: string | null): Tone => (s === "aceptado" ? "green" : s === "rechazado" ? "red" : s ? "amber" : "gray");
const haciendaLabel = (s: string | null) => (s === "aceptado" ? "Aceptada" : s === "rechazado" ? "Rechazada" : s === "sin_respuesta" ? "Sin respuesta" : "");
const statusTone = (s: string): Tone => (s === "vencido" ? "red" : s === "pendiente" ? "amber" : s === "pagado" ? "green" : "gray");

async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", headers: { "Content-Type": "application/json" }, ...init });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error");
  return data as T;
}

export function Dashboard() {
  const [state, setState] = useState<PulsoState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<AlertView | null>(null);
  const [emailId, setEmailId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AlertView | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [tab, setTab] = useState<string>("resumen");

  const refresh = useCallback(async () => {
    const s = await api<PulsoState>("/api/state");
    setState(s);
    return s;
  }, []);

  useEffect(() => {
    api<PulsoState>("/api/state")
      .then((s) => {
        setState(s);
        const id = new URLSearchParams(window.location.search).get("alerta");
        const a = id ? s.alerts.find((x) => x.id === id) : null;
        if (a) setEvidence(a);
      })
      .catch((e) => setToast(e.message));
    // Refresca cada 5 s por si llega una respuesta real por WhatsApp.
    const t = setInterval(() => api<PulsoState>("/api/state").then(setState).catch(() => undefined), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const act = async (label: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(label);
    try {
      await fn();
      await refresh();
      if (ok) setToast(ok);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Algo salió mal.");
    } finally {
      setBusy(null);
    }
  };

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted">
        <PulseIcon className="beat h-8 w-8 text-accent" />
        <span className="ml-3">Tomándole el pulso a tu empresa…</span>
      </main>
    );
  }

  const open = state.alerts.filter((a) => a.status === "abierta");
  const learned = state.alerts.filter((a) => a.status === "normal_aprendido");
  const closed = state.alerts.filter((a) => a.status === "descartada");
  const empty = state.counts.emails === 0;
  const L = LIGHT[state.semaphore.light];

  const ingest = (lote: "lote-1" | "lote-2") =>
    act(lote, () => api("/api/ingest", { method: "POST", body: JSON.stringify({ source: "demo", lote }) }),
      lote === "lote-1" ? "Listo: leí la bandeja." : "Llegó un correo nuevo y lo revisé.");

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6">
      {/* Encabezado */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white">
            <PulseIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">Pulso</h1>
            <p className="text-sm text-muted">El estado de tu empresa, leído de tu correo</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 text-sm sm:text-right">
            <div className="font-medium">{state.company.name}</div>
            <div className="text-muted">Hoy: {fecha(state.today)}</div>
          </div>
          {!state.loaded.lote1 && (
            <Button variant="primary" disabled={!!busy} onClick={() => ingest("lote-1")}>
              {busy === "lote-1" ? "Leyendo…" : "Conectar bandeja de prueba"}
            </Button>
          )}
          {state.loaded.lote1 && !state.loaded.lote2 && (
            <Button variant="primary" disabled={!!busy} onClick={() => ingest("lote-2")}>
              {busy === "lote-2" ? "Revisando…" : "📩 Llegó un correo nuevo"}
            </Button>
          )}
          {!empty && (
            <Button variant="ghost" disabled={!!busy} onClick={() => confirm("¿Reiniciar la demo? Se borran los datos de prueba.") && act("reset", () => api("/api/reset", { method: "POST" }), "Demo reiniciada.")}>
              Reiniciar
            </Button>
          )}
        </div>
      </header>

      <div className="mb-5 flex flex-wrap gap-2 text-xs">
        <Badge tone={state.mode.claude ? "green" : "gray"}>{state.mode.claude ? "Claude activo" : "Extracción sin Claude (heurística)"}</Badge>
        <Badge tone={state.mode.whatsapp ? "green" : "gray"}>{state.mode.whatsapp ? "WhatsApp real (Twilio)" : "WhatsApp simulado"}</Badge>
        <Badge tone={state.mode.store === "supabase" ? "green" : "gray"}>{state.mode.store === "supabase" ? "Supabase" : "Datos locales"}</Badge>
        <Badge tone="gray">Gmail: solo lectura + borradores · nunca envía</Badge>
      </div>

      {!empty && (
        <nav aria-label="Apartados" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div role="tablist" className="flex w-max gap-1 rounded-xl border border-line bg-surface p-1">
            {[{ key: "resumen", label: "Resumen", count: null as number | null }, ...state.categories.filter((c) => c.count > 0).map((c) => ({ key: c.category as string, label: c.label, count: c.count }))].map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-ink text-white" : "text-muted hover:bg-stone-100 hover:text-ink"}`}
              >
                {t.key !== "resumen" && <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[t.key] }} aria-hidden />}
                {t.label}
                {t.count !== null && <span className={`tabular text-xs ${tab === t.key ? "text-white/70" : "text-muted"}`}>{t.count}</span>}
              </button>
            ))}
          </div>
        </nav>
      )}

      {empty ? (
        <EmptyState busy={busy === "lote-1"} onStart={() => ingest("lote-1")} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          {tab !== "resumen" ? (
            <CategoryView
              category={state.categories.find((c) => c.category === tab) ?? state.categories[0]}
              docs={state.documents.filter((d) => d.category === tab)}
              onOpen={setEmailId}
              onBack={() => setTab("resumen")}
            />
          ) : (
          <div className="min-w-0 space-y-5">
            {/* Bitácora del agente */}
            {state.lastRun && (
              <Card className="py-4">
                <div className="flex items-start gap-3">
                  <PulseIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><span className="font-semibold">Lo que hice: </span>{state.lastRun.headline}.</p>
                    {showLog && (
                      <ol className="mt-2 space-y-1 text-sm text-muted">
                        {state.lastRun.steps.map((s, i) => (
                          <li key={i}><span className="font-mono text-xs uppercase text-ink">{s.step}</span> · {s.detail}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                  <Button variant="ghost" onClick={() => setShowLog((v) => !v)}>{showLog ? "Ocultar" : "Paso a paso"}</Button>
                </div>
              </Card>
            )}

            {/* Semáforo */}
            <Card className={`${L.soft} border-transparent`}>
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-4">
                  <span className={`relative flex h-16 w-16 items-center justify-center rounded-full ${L.dot}`} aria-label={`Semáforo en ${L.label}`}>
                    <PulseIcon className="beat h-8 w-8 text-white" />
                  </span>
                  <div>
                    <div className={`text-xs font-semibold uppercase tracking-wide ${L.text}`}>Estado de tu empresa · {L.label}</div>
                    <p className="max-w-xl text-lg font-semibold leading-snug">{state.semaphore.phrase}</p>
                  </div>
                </div>
                <dl className="ml-auto grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <Metric label="Vencido" value={String(state.semaphore.overdueCount)} />
                  <Metric label="No cuadra" value={String(state.semaphore.riskCount)} />
                  <Metric label="Vence en 7 días" value={String(state.semaphore.upcomingCount)} />
                  <Metric label="Dinero en riesgo" value={colones(state.semaphore.moneyAtRisk)} />
                </dl>
              </div>
            </Card>

            {/* Gráficos del estado */}
            <Card>
              <SectionTitle aside={<span className="text-xs text-muted">montos leídos del XML y del correo</span>}>Cómo está tu plata</SectionTitle>
              <div className="grid gap-6 sm:grid-cols-3">
                <Donut
                  title="Lo que debés, por tipo"
                  slices={state.charts.debtByCategory}
                  colors={CATEGORY_COLOR}
                  measure="amount"
                  center={colonesShort(state.charts.debtByCategory.reduce((t, s) => t + s.amount, 0))}
                  centerLabel="por pagar"
                  empty="No debés nada, según tu correo. ✅"
                />
                <Donut
                  title="Estado de tus pagos"
                  slices={state.charts.payments}
                  colors={STATUS_COLOR}
                  measure="amount"
                  center={`${state.charts.payments.reduce((t, s) => t + s.count, 0)}`}
                  centerLabel="cuentas"
                />
                <Donut
                  title="Tus facturas en Hacienda"
                  slices={state.charts.hacienda}
                  colors={STATUS_COLOR}
                  measure="count"
                  center={`${state.charts.hacienda.reduce((t, s) => t + s.count, 0)}`}
                  centerLabel="facturas"
                />
              </div>
            </Card>

            {/* Alertas */}
            <Card>
              <SectionTitle aside={<span className="text-sm text-muted">{open.length} abiertas</span>}>Lo que no cuadra</SectionTitle>
              {open.length === 0 ? (
                <p className="text-sm text-muted">Nada raro por ahora. ✅</p>
              ) : (
                <ul className="divide-y divide-line">
                  {open.map((a) => (
                    <AlertRow
                      key={a.id}
                      a={a}
                      busy={busy}
                      onEvidence={() => setEvidence(a)}
                      onApprove={() => act(a.id + "ap", () => api(`/api/alerts/${a.id}/approve`, { method: "POST" }), "Correo preparado. No envié nada: revisalo y envialo vos.").then(() => setDraft(a))}
                      onDraft={() => setDraft(a)}
                      onNormal={() => {
                        const reason = prompt("¿Por qué es normal? (opcional)", a.type === "monto_inusual" ? "Temporada alta" : "") ?? null;
                        if (reason === null) return;
                        act(a.id + "no", () => api(`/api/alerts/${a.id}/normal`, { method: "POST", body: JSON.stringify({ reason }) }), "Entendido. La próxima vez no te molesto con esto.");
                      }}
                      onDismiss={() => act(a.id + "ds", () => api(`/api/alerts/${a.id}/dismiss`, { method: "POST" }), "Alerta descartada.")}
                    />
                  ))}
                </ul>
              )}
              {learned.length > 0 && (
                <div className="mt-4 rounded-xl bg-stone-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Normal según tus decisiones</p>
                  <ul className="space-y-1 text-sm text-stone-500">
                    {learned.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>{a.title} · {a.counterparty} · {colones(a.amountAtRisk)}</span>
                        <button className="text-xs underline hover:text-ink" onClick={() => setEvidence(a)}>ver</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {state.review.length > 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-line p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Para revisar (confianza baja)</p>
                  <ul className="space-y-1 text-sm">
                    {state.review.map((r) => (
                      <li key={r.emailId}>
                        <button className="text-left hover:underline" onClick={() => setEmailId(r.emailId)}>{r.reason}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {closed.length > 0 && <p className="mt-3 text-xs text-muted">{closed.length} descartada{closed.length > 1 ? "s" : ""}.</p>}
            </Card>

            {/* Próximos y por cobrar */}
            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <SectionTitle>Vence en los próximos 7 días</SectionTitle>
                {state.upcoming.length === 0 ? <p className="text-sm text-muted">Nada en los próximos 7 días.</p> : (
                  <ul className="space-y-2 text-sm">
                    {state.upcoming.map((u) => (
                      <li key={u.emailId} className="flex items-center justify-between gap-3">
                        <button className="text-left hover:underline" onClick={() => setEmailId(u.emailId)}>{u.label}</button>
                        <Badge tone={u.days <= 2 ? "red" : "amber"}>{u.days === 0 ? "hoy" : `${fecha(u.dueDate)}`}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <SectionTitle>Te deben</SectionTitle>
                {state.receivables.length === 0 ? <p className="text-sm text-muted">Nadie te debe, según tu correo.</p> : (
                  <ul className="space-y-2 text-sm">
                    {state.receivables.map((r) => (
                      <li key={r.emailId} className="flex items-center justify-between gap-3">
                        <button className="text-left hover:underline" onClick={() => setEmailId(r.emailId)}>{r.counterparty}</button>
                        <span className="tabular font-medium">{colones(r.amount)} <Badge tone={statusTone(r.status)}>{r.status}</Badge></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* Categorías */}
            <Card>
              <SectionTitle>Tu correo, ordenado</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {state.categories.filter((c) => c.count > 0).map((c) => (
                  <button key={c.category} type="button" onClick={() => setTab(c.category)} className="rounded-xl border border-line p-3 text-left transition-colors hover:border-ink/30 hover:bg-stone-50">
                    <div className="flex items-center gap-1.5 text-sm font-medium"><span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[c.category] }} aria-hidden />{c.label}</div>
                    <div className="text-xs text-muted">{c.count} correo{c.count === 1 ? "" : "s"}</div>
                    {c.category !== "ruido" && (
                      <div className="mt-1 text-sm tabular">{c.pendingCount ? <>{colones(c.pendingTotal)} <span className="text-xs text-muted">pendiente</span></> : <span className="text-xs text-green">al día</span>}</div>
                    )}
                    {c.category === "ruido" && <div className="mt-1 text-xs text-muted">ignorado</div>}
                  </button>
                ))}
              </div>
            </Card>

            {/* Documentos */}
            <Card>
              <SectionTitle aside={<span className="text-sm text-muted">{state.counts.invoices} facturas</span>}>Documentos</SectionTitle>
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase text-muted">
                    <tr className="border-b border-line">
                      <th className="px-5 py-2 font-medium">De</th>
                      <th className="py-2 font-medium">Qué es</th>
                      <th className="py-2 text-right font-medium">Monto</th>
                      <th className="py-2 pl-4 font-medium">Vence</th>
                      <th className="py-2 font-medium">Estado</th>
                      <th className="py-2 pr-5 font-medium">Hacienda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.documents.filter((d) => d.category !== "ruido").map((d) => (
                      <tr key={d.emailId} className="cursor-pointer border-b border-line/70 hover:bg-stone-50" onClick={() => setEmailId(d.emailId)}>
                        <td className="px-5 py-2"><div className="font-medium">{d.counterparty ?? d.from}</div><div className="text-xs text-muted">{fecha(d.receivedAt)}</div></td>
                        <td className="py-2">{d.kind === "factura" ? `Factura …${d.docNumber?.slice(-4)}` : d.summary.slice(0, 48)}</td>
                        <td className="py-2 text-right tabular">
                          {colones(d.amount)}
                          {d.amountSource && <div className="text-[10px] uppercase text-muted">{d.amountSource === "xml" ? "del XML" : d.amountSource === "ia" ? "leído por IA" : "leído del texto"}</div>}
                        </td>
                        <td className="py-2 pl-4">{fecha(d.dueDate)}</td>
                        <td className="py-2"><Badge tone={statusTone(d.status)}>{d.status}</Badge></td>
                        <td className="py-2 pr-5">{d.haciendaStatus && <Badge tone={haciendaTone(d.haciendaStatus)}>{haciendaLabel(d.haciendaStatus)}</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          )}

          {/* Columna derecha */}
          <aside className="min-w-0 space-y-5">
            <Phone
              messages={state.messages}
              real={state.mode.whatsapp}
              busy={busy === "wa"}
              onSend={(body) => act("wa", () => api("/api/whatsapp/simulate", { method: "POST", body: JSON.stringify({ body }) }))}
            />
            <Card>
              <SectionTitle aside={<Button variant="ghost" disabled={!!busy} onClick={() => act("dg", () => api("/api/whatsapp/digest", { method: "POST" }), "Te mandé “Tu semana” por WhatsApp.")}>Enviar por WhatsApp</Button>}>Tu semana</SectionTitle>
              {state.week.length === 0 ? <p className="text-sm text-muted">No hay nada urgente. ✅</p> : (
                <ol className="space-y-3 text-sm">
                  {state.week.slice(0, 7).map((w, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
                      <div>
                        <div className="font-medium">{w.title}{w.amount ? <span className="tabular font-normal text-muted"> · {colones(w.amount)}</span> : null}</div>
                        <div className="text-xs text-muted">{w.why}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card>
              <SectionTitle>Lo que me enseñaste</SectionTitle>
              {state.rules.length === 0 ? (
                <p className="text-sm text-muted">Cuando marqués algo como normal, lo recuerdo aquí y dejo de molestarte con eso.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {state.rules.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{r.counterparty} · {r.alertType.replace("_", " ")}</div>
                        <div className="text-xs text-muted">{r.reason} · {fecha(r.createdAt)} · desde {r.createdFrom}{r.condition.maxRatio ? ` · hasta ${r.condition.maxRatio}× su promedio` : ""}</div>
                      </div>
                      <Button variant="ghost" onClick={() => act("rule", () => api(`/api/rules/${r.id}`, { method: "DELETE" }), "Regla borrada: vuelvo a avisarte.")}>Olvidar</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        </div>
      )}

      {evidence && <EvidenceModal alert={evidence} onClose={() => setEvidence(null)} onOpenEmail={(id) => setEmailId(id)} />}
      {emailId && <EmailModal emailId={emailId} onClose={() => setEmailId(null)} />}
      {draft && <DraftModal alert={state.alerts.find((a) => a.id === draft.id) ?? draft} onClose={() => setDraft(null)} />}

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular text-lg font-semibold">{value}</dd>
    </div>
  );
}

function AlertRow({ a, busy, onEvidence, onApprove, onDraft, onNormal, onDismiss }: {
  a: AlertView; busy: string | null; onEvidence: () => void; onApprove: () => void; onDraft: () => void; onNormal: () => void; onDismiss: () => void;
}) {
  const approved = a.action && a.action.status !== "pendiente" && a.action.status !== "descartada";
  const canNormal = a.type !== "rechazo_hacienda" && !(a.type === "duplicado" && a.confidence === "alta");
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{a.title}</span>
            <Badge tone={confTone(a.confidence)}>confianza {a.confidence}</Badge>
            {a.notified && <Badge tone="green">avisado por WhatsApp</Badge>}
          </div>
          <div className="mt-0.5 text-sm text-muted">{a.counterparty}{a.amountAtRisk ? <> · <span className="tabular font-medium text-ink">{colones(a.amountAtRisk)}</span> {a.type === "vencido" && a.meta.porCobrar ? "por cobrar" : "en riesgo"}</> : null}</div>
          <p className="mt-1 text-sm">{a.explanation}</p>
          <p className="mt-1 text-xs text-muted">Por qué: {a.reason}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={onEvidence}>Ver evidencia</Button>
        {approved ? (
          <Button variant="primary" onClick={onDraft}>✓ Correo listo · ver</Button>
        ) : (
          <Button variant="primary" disabled={busy === a.id + "ap"} onClick={onApprove}>{a.type === "vencido" && !a.meta.porCobrar ? "Crear recordatorio" : "Preparar correo"}</Button>
        )}
        {canNormal && <Button variant="ghost" disabled={busy === a.id + "no"} onClick={onNormal}>Es normal</Button>}
        <Button variant="ghost" onClick={onDismiss}>Descartar</Button>
      </div>
    </li>
  );
}

function EmptyState({ onStart, busy }: { onStart: () => void; busy: boolean }) {
  return (
    <Card className="mx-auto max-w-3xl p-8 text-center">
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <PulseIcon className="beat h-8 w-8" />
      </span>
      <h2 className="text-2xl font-bold">¿Cómo está tu empresa hoy?</h2>
      <p className="mx-auto mt-2 max-w-xl text-muted">
        Pulso lee tu correo (facturas electrónicas, Hacienda, la Caja, el contador, el banco), te dice qué debés, qué vence y qué no cuadra,
        y te avisa por WhatsApp. Nada se envía sin tu aprobación.
      </p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <Button variant="primary" disabled={busy} onClick={onStart}>{busy ? "Leyendo tu correo…" : "Probar con la bandeja de prueba"}</Button>
        <span className="text-xs text-muted">Ferretería El Roble S.A. · empresa ficticia · 36 correos de noviembre</span>
      </div>
    </Card>
  );
}

const STATUS_ORDER: Record<string, number> = { vencido: 0, pendiente: 1, pagado: 2, informativo: 3 };

function CategoryView({ category, docs, onOpen, onBack }: {
  category: PulsoState["categories"][number];
  docs: DocView[];
  onOpen: (emailId: string) => void;
  onBack: () => void;
}) {
  const sorted = [...docs].sort((a, b) =>
    (b.openAlerts > 0 ? 1 : 0) - (a.openAlerts > 0 ? 1 : 0) || (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.receivedAt.localeCompare(a.receivedAt));
  const withAlerts = docs.filter((d) => d.openAlerts > 0).length;
  const paid = docs.filter((d) => d.status === "pagado");
  const isNoise = category.category === "ruido";
  const isClients = category.category === "clientes";

  return (
    <div className="min-w-0 space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button onClick={onBack} className="mb-1 text-xs text-muted hover:text-ink hover:underline">← Resumen</button>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <span className="h-3 w-3 rounded-full" style={{ background: CATEGORY_COLOR[category.category] }} aria-hidden />
              {category.label}
            </h2>
            <p className="text-sm text-muted">{category.count} correo{category.count === 1 ? "" : "s"}{isNoise ? " que Pulso ignora (publicidad, boletines)." : "."}</p>
          </div>
          {!isNoise && (
            <dl className="grid grid-cols-3 gap-x-6 text-sm">
              <Metric label={isClients ? "Te deben" : "Pendiente"} value={category.pendingCount ? colones(category.pendingTotal) : "₡0"} />
              <Metric label="Pagados" value={String(paid.length)} />
              <Metric label="No cuadra" value={String(withAlerts)} />
            </dl>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden p-0!">
        <ul className="divide-y divide-line">
          {sorted.map((d) => (
            <li key={d.emailId}>
              <button onClick={() => onOpen(d.emailId)} className="flex w-full flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3 text-left transition-colors hover:bg-stone-50">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.counterparty ?? d.from}</span>
                    {d.openAlerts > 0 && <Badge tone="red">⚠ no cuadra</Badge>}
                  </div>
                  <div className="truncate text-sm text-muted">{d.kind === "factura" ? `Factura …${d.docNumber?.slice(-4)} · ${d.subject}` : d.subject}</div>
                  <div className="text-xs text-muted">Llegó el {fecha(d.receivedAt)}{d.dueDate ? ` · vence ${fecha(d.dueDate)}` : ""}</div>
                </div>
                {!isNoise && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="tabular font-semibold">{colones(d.amount)}</span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {d.status !== "informativo" && <Badge tone={statusTone(d.status)}>{d.status}</Badge>}
                      {d.haciendaStatus && <Badge tone={haciendaTone(d.haciendaStatus)}>{haciendaLabel(d.haciendaStatus)}</Badge>}
                    </div>
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
