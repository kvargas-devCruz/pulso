"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { PulsoState } from "@/lib/state";
import { Avatar, Badge, Button, Card, PulseIcon, SectionTitle, colones, fecha, type Tone } from "./ui";
import { AskPulso, LiveRun, type LiveAlert, type LiveRunState } from "./Agent";
import { EvidenceModal, EmailModal, DraftModal } from "./Modals";
import { Phone } from "./Phone";
import { BarChart, CATEGORY_COLOR, Donut, METHOD_COLOR, STATUS_COLOR, colonesShort } from "./Charts";

type AlertView = PulsoState["alerts"][number];
type DocView = PulsoState["documents"][number];
type View = "inicio" | "correo" | "plata" | "whatsapp" | "reservas";

const LIGHT = {
  rojo: { dot: "bg-red", soft: "bg-red-soft", text: "text-red", label: "Rojo" },
  amarillo: { dot: "bg-amber", soft: "bg-amber-soft", text: "text-amber", label: "Amarillo" },
  verde: { dot: "bg-green", soft: "bg-green-soft", text: "text-green", label: "Verde" },
} as const;

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
  const [view, setView] = useState<View>("inicio");
  const [cat, setCat] = useState<string>("todos");
  const [live, setLive] = useState<LiveRunState | null>(null);
  const [seenMsgs, setSeenMsgs] = useState(0);

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
  const owed = state.charts.debtByCategory.reduce((t, x) => t + x.amount, 0);
  const paidTotal = state.charts.payments.find((x) => x.key === "pagado")?.amount ?? 0;
  const receivableTotal = state.receivables.reduce((t, r) => t + (r.amount ?? 0), 0);
  const receivableOverdue = state.receivables.filter((r) => r.status === "vencido" || (r.dueDate !== null && r.dueDate < state.today)).reduce((t, r) => t + (r.amount ?? 0), 0);
  // Ventas de los últimos 7 días (cierres de caja), y qué parte fue con tarjeta.
  const weekStart = new Date(Date.parse(state.today + "T00:00:00Z") - 6 * 86_400_000).toISOString().slice(0, 10);
  const weekSales = state.charts.salesByDay.filter((d) => d.key >= weekStart);
  const weekSalesTotal = weekSales.reduce((t, d) => t + d.amount, 0);
  const weekCard = weekSales.reduce((t, d) => t + d.card, 0);

  // Procesar correos con el agente a la vista: los pasos reales se revelan uno por uno.
  const ingest = async (lote: "lote-1" | "lote-2") => {
    const label = lote === "lote-1" ? "Bandeja de prueba" : "Llegó un correo nuevo";
    setView("inicio");
    setBusy(lote);
    setLive({ label, steps: null, alerts: [], headline: null });
    try {
      const r = await api<{ run: { steps: { step: string; detail: string }[]; headline: string }; alerts: LiveAlert[]; notified: boolean }>(
        "/api/ingest", { method: "POST", body: JSON.stringify({ source: "demo", lote }) });
      setLive({ label, steps: r.run.steps, alerts: r.alerts, headline: r.run.headline, notified: r.notified });
      // El panel se actualiza cuando termina la animación (≈ 420 ms por paso).
      setTimeout(() => { refresh().catch(() => undefined); setLive((l) => (l ? { ...l, done: true } : l)); }, r.run.steps.length * 420 + 150);
    } catch (e) {
      setLive(null);
      setToast(e instanceof Error ? e.message : "Algo salió mal.");
    } finally {
      setBusy(null);
    }
  };
  const openAlert = (id: string) => {
    const a = state.alerts.find((x) => x.id === id);
    if (a) setEvidence(a);
    else refresh().then((s) => { const b = s.alerts.find((x) => x.id === id); if (b) setEvidence(b); });
  };

  // Columna derecha según la sección: solo lo que ayuda a actuar ahí.
  const asideFor: Partial<Record<View, ReactNode>> = {
    inicio: (
      <>
        <TodayPanel state={state} onGo={setView} />
        <AskPulso suggestions={state.suggestions} onOpenEmail={setEmailId} compact />
      </>
    ),
    plata: <UpcomingAndReceivables state={state} onOpen={setEmailId} />,
    whatsapp: (
      <>
        <WeekCard week={state.week} busy={!!busy} onSend={() => act("dg", () => api("/api/whatsapp/digest", { method: "POST" }), "Te mandé “Tu semana” por WhatsApp.")} />
        <LearnedCard rules={state.rules} onForget={(id) => act("rule", () => api(`/api/rules/${id}`, { method: "DELETE" }), "Regla borrada: vuelvo a avisarte.")} />
      </>
    ),
  };
  const aside = asideFor[view] ?? null;
  const nextDemoStep = !state.loaded.lote1 ? ("lote-1" as const) : !state.loaded.lote2 ? ("lote-2" as const) : null;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6">
      {/* Barra superior: marca · secciones · empresa · controles de la demo (aparte) */}
      <header className="card-soft mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-3xl bg-surface px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7b6ff0] to-[#4a3fd0] text-white shadow-md shadow-accent/30">
            <PulseIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight">Pulso</h1>
            <p className="hidden text-xs text-muted sm:block">{state.company.name} · hoy {fecha(state.today)}</p>
          </div>
        </div>

        {!empty && (
          <nav aria-label="Secciones" className="order-last flex w-full justify-around gap-1 border-t border-line pt-2 md:order-none md:w-auto md:flex-1 md:justify-center md:border-0 md:pt-0">
            {NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => { if (view === "whatsapp") setSeenMsgs(state.messages.length); setView(n.key); if (n.key === "whatsapp") setSeenMsgs(state.messages.length); }}
                aria-current={view === n.key ? "page" : undefined}
                className={`group relative flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${view === n.key ? "text-accent" : "text-muted hover:text-ink"}`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${view === n.key ? "bg-accent-soft" : "group-hover:bg-stone-100"}`}>{n.icon}</span>
                {n.label}
                {n.key === "inicio" && open.length > 0 && <span className="absolute right-2.5 top-1 h-2 w-2 rounded-full bg-red ring-2 ring-surface" aria-label={`${open.length} alertas abiertas`} />}
                {n.key === "whatsapp" && view !== "whatsapp" && state.messages.length > seenMsgs && <span className="absolute right-2.5 top-1 h-2 w-2 rounded-full bg-[#25d366] ring-2 ring-surface" aria-label="Mensajes nuevos de WhatsApp" />}
              </button>
            ))}
          </nav>
        )}

        {/* Demo: separado del producto */}
        <div className="ml-auto flex items-center gap-1 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/40 py-1 pl-3 pr-1">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-accent">Demo</span>
          {nextDemoStep && (
            <Button variant="primary" disabled={!!busy} onClick={() => ingest(nextDemoStep)}>
              {busy === nextDemoStep ? "Leyendo…" : nextDemoStep === "lote-1" ? "Cargar bandeja de prueba" : "📩 Llegó un correo nuevo"}
            </Button>
          )}
          {!empty && (
            <Button variant="ghost" title="Reiniciar la demo" disabled={!!busy} onClick={() => confirm("¿Reiniciar la demo? Se borran los datos de prueba.") && (setLive(null), act("reset", () => api("/api/reset", { method: "POST" }), "Demo reiniciada."))}>
              ↺ Reiniciar
            </Button>
          )}
        </div>
      </header>

      {state.ringing && view !== "whatsapp" && (
        <button onClick={() => setView("whatsapp")} className="mb-5 flex w-full items-center gap-3 rounded-2xl bg-[#075e54] px-4 py-3 text-left text-white shadow-lg">
          <span className="text-2xl [animation:pulso-beat_1.2s_ease-in-out_infinite]" aria-hidden>📞</span>
          <span className="flex-1"><strong>Pulso te está llamando</strong> · recordatorio que pediste por WhatsApp</span>
          <span className="rounded-full bg-[#25d366] px-3 py-1 text-sm font-semibold">Contestar</span>
        </button>
      )}

      {empty && live ? (
        <div className="mx-auto max-w-xl"><LiveRun run={live} onClose={() => setLive(null)} onOpenAlert={openAlert} onOpenWhatsApp={() => setView("whatsapp")} /></div>
      ) : empty ? (
        <EmptyState busy={busy === "lote-1"} onStart={() => ingest("lote-1")} />
      ) : (
        <div className={`grid gap-5 ${aside ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
          <div className="min-w-0 space-y-5">
            {/* ------------------------------------------------ INICIO */}
            {view === "inicio" && (<>
              {live && <LiveRun run={live} onClose={() => setLive(null)} onOpenAlert={openAlert} onOpenWhatsApp={() => setView("whatsapp")} />}

              {/* 1. Estado: semáforo + números clave + última revisión */}
              <Card>
                <div className="flex items-center gap-4">
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${L.dot}`} aria-label={`Semáforo en ${L.label}`}>
                    <PulseIcon className="beat h-7 w-7 text-white" />
                  </span>
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold uppercase tracking-wide ${L.text}`}>Estado de tu empresa · {L.label}</div>
                    <p className="text-lg font-semibold leading-snug">{state.semaphore.phrase}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatTile label="Por pagar" value={colonesShort(owed)} hint={`${owed + paidTotal ? Math.round((100 * paidTotal) / (owed + paidTotal)) : 0} % ya pagado`} onClick={() => setView("plata")} />
                  <StatTile label="Te deben" value={colonesShort(receivableTotal)} hint={receivableOverdue ? `${colonesShort(receivableOverdue)} vencido` : "nada vencido"} onClick={() => setView("plata")} />
                  <StatTile label="Dinero en riesgo" value={colonesShort(state.semaphore.moneyAtRisk)} hint={`${open.length} ${open.length === 1 ? "alerta" : "alertas"}`} tone="red" />
                  <StatTile label="Ventas de la semana" value={colonesShort(weekSalesTotal)} hint={weekSales.length ? `${Math.round((100 * weekCard) / weekSalesTotal)} % con tarjeta` : "sin cierres"} onClick={() => setView("plata")} />
                </dl>
                {state.lastRun && !live && (
                  <div className="mt-4 border-t border-line pt-3 text-sm text-muted">
                    <button onClick={() => setShowLog((v) => !v)} className="flex w-full items-start gap-2 text-left hover:text-ink">
                      <PulseIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span className="min-w-0 flex-1"><span className="font-medium text-ink">Última revisión:</span> {state.lastRun.headline}.</span>
                      <span className="shrink-0 text-xs">{showLog ? "ocultar ▴" : "paso a paso ▾"}</span>
                    </button>
                    {showLog && (
                      <ol className="mt-2 space-y-1 pl-6">
                        {state.lastRun.steps.map((st, i) => <li key={i}><span className="font-medium text-ink">{STEP_NAMES[st.step] ?? st.step}</span> · {st.detail}</li>)}
                      </ol>
                    )}
                  </div>
                )}
              </Card>

              {/* 2. Lo que no cuadra: lista compacta, cada fila se abre */}
              <Card>
                <SectionTitle aside={open.length ? <span className="rounded-full bg-red-soft px-2.5 py-0.5 text-xs font-semibold text-red">{open.length} para revisar</span> : null}>Lo que no cuadra</SectionTitle>
                {open.length === 0 ? (
                  <div className="flex flex-col items-center rounded-2xl bg-green-soft px-6 py-8 text-center">
                    <span className="mb-2 text-3xl" aria-hidden>✅</span>
                    <p className="font-semibold text-green">Nada para revisar hoy</p>
                    <p className="mt-1 text-sm text-muted">Sigo vigilando tu correo y tu WhatsApp. Si llega algo raro, te aviso.</p>
                  </div>
                ) : (
                  <ul className="-mx-2 divide-y divide-line">
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
                {(state.review.length > 0 || learned.length > 0 || closed.length > 0) && (
                  <div className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
                    {state.review.length > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer list-none text-muted hover:text-ink">▸ Para revisar, confianza baja ({state.review.length})</summary>
                        <ul className="mt-2 space-y-1 pl-4">
                          {state.review.map((r) => <li key={r.emailId}><button className="text-left hover:underline" onClick={() => setEmailId(r.emailId)}>{r.reason}</button></li>)}
                        </ul>
                      </details>
                    )}
                    {learned.length > 0 && (
                      <details>
                        <summary className="cursor-pointer list-none text-muted hover:text-ink">▸ Normal según tus decisiones ({learned.length})</summary>
                        <ul className="mt-2 space-y-1 pl-4 text-stone-500">
                          {learned.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-center gap-2">
                              <Avatar name={a.counterparty} size={20} /><span>{a.title} · {a.counterparty} · {colones(a.amountAtRisk)}</span>
                              <button className="text-xs underline hover:text-ink" onClick={() => setEvidence(a)}>ver</button>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {closed.length > 0 && <p className="text-xs text-muted">{closed.length} descartada{closed.length > 1 ? "s" : ""}.</p>}
                  </div>
                )}
              </Card>
            </>)}

            {/* ------------------------------------------------ MENSAJES */}
            {view === "correo" && (<>
              <MailTabs categories={state.categories} cat={cat} onPick={setCat} whatsapp={state.counts.whatsapp} />
              {cat !== "todos" ? (
                <CategoryView
                  category={cat === "whatsapp"
                    ? {
                        category: "whatsapp" as PulsoState["categories"][number]["category"], label: "WhatsApp", count: state.counts.whatsapp,
                        pendingCount: state.documents.filter((d) => d.channel === "whatsapp" && (d.status === "pendiente" || d.status === "vencido") && d.amount).length,
                        pendingTotal: state.documents.filter((d) => d.channel === "whatsapp" && (d.status === "pendiente" || d.status === "vencido")).reduce((t, d) => t + (d.amount ?? 0), 0),
                      }
                    : state.categories.find((c) => c.category === cat) ?? state.categories[0]}
                  docs={state.documents.filter((d) => (cat === "whatsapp" ? d.channel === "whatsapp" : d.category === cat))}
                  onOpen={setEmailId}
                  onBack={() => setCat("todos")}
                />
              ) : (
                <Card>
                  <SectionTitle aside={<span className="text-sm text-muted">{state.counts.invoices} facturas · {state.counts.emails} mensajes</span>}>Todos los mensajes</SectionTitle>
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
                            <td className="px-5 py-2"><div className="flex items-center gap-2.5"><Avatar name={d.counterparty ?? d.from} size={30} /><div><div className="flex flex-wrap items-center gap-1.5 font-medium">{d.counterparty ?? d.from}<ChannelTag channel={d.channel} /></div><div className="text-xs text-muted">{fecha(d.receivedAt)}</div></div></div></td>
                            <td className="py-2">{d.kind === "factura" ? `Factura …${d.docNumber?.slice(-4)}` : d.summary.slice(0, 48)}</td>
                            <td className="py-2 text-right tabular">
                              {colones(d.amount)}
                              {d.amountSource && <div className="text-[10px] uppercase text-muted">{d.amountSource === "xml" ? "del XML" : d.amountSource === "archivo" ? "del archivo" : d.amountSource === "ia" ? "leído por IA" : "leído del texto"}</div>}
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
              )}
            </>)}

            {/* ------------------------------------------------ PLATA */}
            {view === "plata" && (<>
              <Card>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <StatTile label="Por pagar" value={colones(owed)} hint={`${owed + paidTotal ? Math.round((100 * paidTotal) / (owed + paidTotal)) : 0} % ya pagado`} />
                  <StatTile label="Te deben" value={colones(receivableTotal)} hint={receivableOverdue ? `${colones(receivableOverdue)} vencido` : "nada vencido"} />
                  <StatTile label="Ventas de la semana" value={colones(weekSalesTotal)} hint={`${weekSales.length} cierres de caja`} />
                </dl>
              </Card>
              <Card>
                <SectionTitle aside={<span className="text-xs text-muted">sin contar lo ya pagado</span>}>Lo que vence, por semana</SectionTitle>
                <BarChart data={state.charts.dueByWeek} empty="No tenés nada pendiente de pagar. ✅" />
              </Card>
              <Card>
                <SectionTitle aside={<span className="text-xs text-muted">montos leídos del XML y del correo</span>}>Cómo está tu plata</SectionTitle>
                <div className="grid gap-6 sm:grid-cols-3">
                  <Donut title="Lo que debés, por tipo" slices={state.charts.debtByCategory} colors={CATEGORY_COLOR} measure="amount" center={colonesShort(state.charts.debtByCategory.reduce((t, x) => t + x.amount, 0))} centerLabel="por pagar" empty="No debés nada, según tu correo. ✅" />
                  <Donut title="Estado de tus pagos" slices={state.charts.payments} colors={STATUS_COLOR} measure="amount" center={`${state.charts.payments.reduce((t, x) => t + x.count, 0)}`} centerLabel="cuentas" />
                  <Donut title="Tus facturas en Hacienda" slices={state.charts.hacienda} colors={STATUS_COLOR} measure="count" center={`${state.charts.hacienda.reduce((t, x) => t + x.count, 0)}`} centerLabel="facturas" />
                </div>
              </Card>
              <Card>
                <SectionTitle aside={<span className="text-xs text-muted">de tus cierres de caja</span>}>Tus ventas</SectionTitle>
                {state.charts.salesByDay.length === 0 ? (
                  <p className="text-sm text-muted">Cuando lleguen los cierres de caja de tu sistema de facturación, vas a ver aquí lo que vendés cada día.</p>
                ) : (
                  <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
                    <BarChart
                      data={state.charts.salesByDay}
                      color="#008300"
                      detail={(d) => {
                        const day = state.charts.salesByDay.find((x) => x.key === d.key)!;
                        return `${day.count} facturas · tarjeta ${colonesShort(day.card)} · efectivo ${colonesShort(day.cash)} · SINPE ${colonesShort(day.sinpe)}`;
                      }}
                    />
                    <Donut title="Cómo te pagan" slices={state.charts.salesByMethod} colors={METHOD_COLOR} measure="amount" center={colonesShort(state.charts.salesByMethod.reduce((t, m) => t + m.amount, 0))} centerLabel="vendido" />
                  </div>
                )}
              </Card>
            </>)}

            {/* ------------------------------------------------ RESERVAS y WHATSAPP */}
            {view === "reservas" && <ReservationsView reservations={state.reservations} today={state.today} onOpen={setEmailId} />}
            {view === "whatsapp" && (
              <WhatsAppView
                state={state}
                busy={busy === "wa"}
                onCall={(callId, outcome) => { api(`/api/calls/${callId}`, { method: "POST", body: JSON.stringify({ outcome }) }).then(() => refresh()).catch(() => undefined); }}
                onReminder={(rid, action) => act("rem" + rid, () => api(`/api/reminders/${rid}`, { method: "POST", body: JSON.stringify({ action }) }), action === "borrar" ? "Recordatorio borrado." : "Ahí viene la llamada…")}
                onSend={(body) => act("wa", () => api("/api/whatsapp/simulate", { method: "POST", body: JSON.stringify({ body }) }))}
                onDigest={() => act("dg", () => api("/api/whatsapp/digest", { method: "POST" }), "Te mandé “Tu semana” por WhatsApp.")}
              />
            )}
          </div>

          {aside && <aside className="min-w-0 space-y-5">{aside}</aside>}
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
  const [openRow, setOpenRow] = useState(false);
  const approved = a.action && a.action.status !== "pendiente" && a.action.status !== "descartada";
  const canNormal = a.type !== "rechazo_hacienda" && !(a.type === "duplicado" && a.confidence === "alta");
  const porCobrar = a.type === "vencido" && a.meta.porCobrar;
  return (
    <li className="px-2 py-2.5">
      <div className="flex items-center gap-3">
        <button onClick={() => setOpenRow((v) => !v)} aria-expanded={openRow} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar name={a.counterparty} size={34} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${a.confidence === "alta" ? "bg-red" : "bg-amber"}`} title={`confianza ${a.confidence}`} aria-label={`confianza ${a.confidence}`} />
              <span className="font-semibold">{a.title}</span>
              <ChannelTag channel={a.channel} />
            </span>
            <span className="block truncate text-sm text-muted">{a.counterparty}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="tabular block font-bold">{colones(a.amountAtRisk)}</span>
            <span className="block text-[11px] text-muted">{porCobrar ? "por cobrar" : "en riesgo"}</span>
          </span>
          <span className={`shrink-0 text-muted transition-transform ${openRow ? "rotate-180" : ""}`} aria-hidden>▾</span>
        </button>
        <span className="hidden shrink-0 sm:block">
          {approved
            ? <Button variant="secondary" onClick={onDraft}>✓ Correo listo</Button>
            : <Button variant="primary" disabled={busy === a.id + "ap"} onClick={onApprove}>{a.type === "vencido" && !porCobrar ? "Recordatorio" : "Preparar correo"}</Button>}
        </span>
      </div>
      {openRow && (
        <div className="mt-2 rounded-xl bg-bg/70 p-3 text-sm sm:ml-[46px]">
          <p>{a.explanation}</p>
          <p className="mt-1 text-xs text-muted">Por qué: {a.reason} · confianza {a.confidence}{a.notified ? " · avisado por WhatsApp" : ""}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="sm:hidden">
              {approved
                ? <Button variant="secondary" onClick={onDraft}>✓ Correo listo</Button>
                : <Button variant="primary" disabled={busy === a.id + "ap"} onClick={onApprove}>{a.type === "vencido" && !porCobrar ? "Crear recordatorio" : "Preparar correo"}</Button>}
            </span>
            <Button onClick={onEvidence}>Ver evidencia</Button>
            {canNormal && <Button variant="ghost" disabled={busy === a.id + "no"} onClick={onNormal}>Es normal</Button>}
            <Button variant="ghost" onClick={onDismiss}>Descartar</Button>
          </div>
        </div>
      )}
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
        <span className="text-xs text-muted">Restaurante La Fogata S.A. · empresa ficticia · 58 correos de noviembre</span>
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
            <button onClick={onBack} className="mb-1 text-xs text-muted hover:text-ink hover:underline">← Todos los mensajes</button>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <span className="h-3 w-3 rounded-full" style={{ background: CATEGORY_COLOR[category.category] }} aria-hidden />
              {category.label}
            </h2>
            <p className="text-sm text-muted">{category.count} mensaje{category.count === 1 ? "" : "s"}{isNoise ? " que Pulso ignora (publicidad, boletines)." : "."}</p>
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
                <Avatar name={d.counterparty ?? d.from} size={36} />
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.counterparty ?? d.from}</span>
                    <ChannelTag channel={d.channel} />
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

// ---------------------------------------------------------------------------
// Navegación e íconos (trazo simple, heredan el color del texto).
const ico = "h-[18px] w-[18px]";
const Svg = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const IconHome = () => <Svg d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" />;
const IconMail = () => <Svg d="M3 6h18v12H3zM3 7l9 6 9-6" />;
const IconChat = () => <Svg d="M4 20l1.4-4A8 8 0 1 1 8 18.6zM9 10h.01M12 10h.01M15 10h.01" />;
const IconChart = () => <Svg d="M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z" />;
const IconCalendar = () => <Svg d="M4 6h16v15H4zM4 10h16M9 3v4M15 3v4" />;

const NAV: { key: View; label: string; icon: ReactNode }[] = [
  { key: "inicio", label: "Inicio", icon: <IconHome /> },
  { key: "correo", label: "Mensajes", icon: <IconMail /> },
  { key: "plata", label: "Plata", icon: <IconChart /> },
  { key: "reservas", label: "Reservas", icon: <IconCalendar /> },
  { key: "whatsapp", label: "WhatsApp", icon: <IconChat /> },
];

function MailTabs({ categories, cat, onPick, whatsapp }: { categories: PulsoState["categories"]; cat: string; onPick: (c: string) => void; whatsapp: number }) {
  const total = categories.reduce((t, c) => t + c.count, 0);
  const tabs = [{ key: "todos", label: "Todo", count: total }, ...(whatsapp ? [{ key: "whatsapp", label: "WhatsApp", count: whatsapp }] : []), ...categories.filter((c) => c.count > 0).map((c) => ({ key: c.category as string, label: c.label, count: c.count }))];
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
      <div role="tablist" aria-label="Tipos de correo" className="card-soft flex w-max gap-1 rounded-2xl bg-surface p-1.5 sm:w-full sm:flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={cat === t.key}
            onClick={() => onPick(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${cat === t.key ? "bg-accent text-white" : "text-muted hover:bg-stone-100 hover:text-ink"}`}
          >
            {t.key !== "todos" && <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[t.key] }} aria-hidden />}
            {t.label}
            <span className={`tabular text-xs ${cat === t.key ? "text-white/75" : "text-muted"}`}>{t.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp en su propio apartado: el celular del dueño y cómo se usa.
function WhatsAppView({ state, busy, onSend, onDigest, onCall, onReminder }: {
  state: PulsoState; busy: boolean; onSend: (body: string) => void; onDigest: () => void;
  onCall: (callId: string, outcome: "atendida" | "perdida") => void; onReminder: (id: string, action: "probar" | "borrar") => void;
}) {
  const sent = state.messages.filter((m) => m.direction === "saliente" && m.kind === "alerta").length;
  const replies = state.messages.filter((m) => m.direction === "entrante").length;
  return (
    <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="min-w-0">
        <Phone messages={state.messages} real={state.mode.whatsapp} busy={busy} onSend={onSend} ringing={state.ringing} onCall={onCall} />
      </div>
      <div className="min-w-0 space-y-5">
        <Card>
          <SectionTitle>Así te avisa Pulso</SectionTitle>
          <p className="text-sm">Cuando aparece algo que no cuadra (confianza alta o media), Pulso te escribe por WhatsApp con un resumen, el monto y un link. Respondés desde el celular:</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-bold text-accent">1</span><span><strong>Preparar el correo</strong> para resolverlo. Queda como borrador: nada se envía sin que lo revisés.</span></li>
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-bold text-accent">2</span><span><strong>Es normal.</strong> Pulso lo aprende y no te vuelve a molestar con casos iguales (nunca con un rechazo de Hacienda).</span></li>
            <li className="flex gap-3"><span className="flex h-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft px-1.5 text-xs font-bold text-accent">VER</span><span>Te manda el link a la evidencia.</span></li>
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent" aria-hidden>⏰</span><span><strong>Acordame…</strong>: “acordame el viernes a las 9 que debo pagar la CCSS”. A esa hora Pulso te <strong>llama</strong> y te lo recuerda con el monto.</span></li>
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent" aria-hidden>?</span><span>Cualquier otra cosa es una <strong>pregunta</strong>: “¿Quién me debe?”, “¿Cuadró el datáfono ayer?”.</span></li>
          </ul>
        </Card>
        <Reminders reminders={state.reminders} onAction={onReminder} />
        <Card>
          <SectionTitle aside={<Button variant="ghost" onClick={onDigest}>Enviar “Tu semana”</Button>}>Resumen</SectionTitle>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="Avisos enviados" value={String(sent)} />
            <Metric label="Respuestas tuyas" value={String(replies)} />
            <Metric label="Modo" value={state.mode.whatsapp ? "Real" : "Simulado"} />
          </dl>
          <p className="mt-3 text-xs text-muted">
            {state.mode.whatsapp
              ? "Los mensajes salen por Twilio a tu WhatsApp. Sin spam: se agrupan por corrida y hay un tope diario."
              : "Modo simulado: los mensajes se ven en este celular. Con Twilio configurado, llegan a tu WhatsApp de verdad. Sin spam: se agrupan por corrida y hay un tope diario."}
          </p>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reservas (restaurante): próximas 7 noches, agrupadas por día.
type ReservationView = PulsoState["reservations"][number];
const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const addDaysIso = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
function dayLabel(date: string, today: string) {
  const name = DAY_NAMES[new Date(date + "T00:00:00Z").getUTCDay()];
  const rel = date === today ? "Hoy" : date === addDaysIso(today, 1) ? "Mañana" : name[0].toUpperCase() + name.slice(1);
  return `${rel}${date === today || date === addDaysIso(today, 1) ? ` · ${name}` : ""} ${fecha(date).slice(0, 5)}`;
}

function ReservationsView({ reservations, today, onOpen }: { reservations: ReservationView[]; today: string; onOpen: (emailId: string) => void }) {
  const days = [...new Set(reservations.map((r) => r.date))];
  const active = reservations.filter((r) => r.status !== "cancelada");
  const people = active.reduce((t, r) => t + r.people, 0);
  const pending = active.filter((r) => r.status === "por_confirmar").length;
  const deposits = active.reduce((t, r) => t + (r.deposit ?? 0), 0);
  return (
    <div className="min-w-0 space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold"><span aria-hidden>🍽️</span> Próximas reservas</h2>
            <p className="text-sm text-muted">Leídas de tu correo: la plataforma de reservas y los clientes que te escriben directo.</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <Metric label="Reservas" value={String(active.length)} />
            <Metric label="Personas" value={String(people)} />
            <Metric label="Por confirmar" value={String(pending)} />
            <Metric label="Anticipos" value={deposits ? colones(deposits) : "₡0"} />
          </dl>
        </div>
      </Card>
      {days.length === 0 && <Card><p className="text-sm text-muted">No tenés reservas en los próximos 7 días.</p></Card>}
      {days.map((day) => {
        const list = reservations.filter((r) => r.date === day);
        const act = list.filter((r) => r.status !== "cancelada");
        return (
          <Card key={day} className="overflow-hidden p-0!">
            <div className={`flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3 ${day === today ? "bg-accent-soft" : ""}`}>
              <h3 className="font-semibold">{dayLabel(day, today)}</h3>
              <span className="text-sm text-muted">{act.length} {act.length === 1 ? "reserva" : "reservas"} · {act.reduce((t, r) => t + r.people, 0)} personas</span>
            </div>
            <ul className="divide-y divide-line">
              {list.map((r) => {
                const cancelled = r.status === "cancelada";
                return (
                  <li key={r.emailId}>
                    <button onClick={() => onOpen(r.emailId)} className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left transition-colors hover:bg-stone-50 ${cancelled ? "opacity-55" : ""}`}>
                      <span className="tabular w-12 shrink-0 text-lg font-bold">{r.time ?? "—"}</span>
                      <Avatar name={r.name} size={34} />
                      <div className="min-w-0 flex-1 basis-40">
                        <div className={`flex flex-wrap items-center gap-1.5 font-medium ${cancelled ? "line-through" : ""}`}>{r.name}<ChannelTag channel={r.channel} /></div>
                        {r.notes && <div className="text-xs text-muted">{r.notes}</div>}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-sm font-semibold tabular">👥 {r.people}</span>
                        {r.deposit ? <Badge tone="green">anticipo {colones(r.deposit)}</Badge> : null}
                        {r.status === "por_confirmar" && <Badge tone="amber">por confirmar</Badge>}
                        {cancelled && <Badge tone="gray">cancelada</Badge>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recordatorios que el dueño pidió por WhatsApp.
const CR_MS = 6 * 3600_000;
function dueLabel(iso: string) {
  const t = new Date(Date.parse(iso) - CR_MS);
  const days = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  return `${days[t.getUTCDay()]} ${String(t.getUTCDate()).padStart(2, "0")}/${String(t.getUTCMonth() + 1).padStart(2, "0")} · ${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
}

function Reminders({ reminders, onAction }: { reminders: PulsoState["reminders"]; onAction: (id: string, action: "probar" | "borrar") => void }) {
  const pending = reminders.filter((r) => r.status === "pendiente");
  const done = reminders.filter((r) => r.status === "hecho").slice(-3).reverse();
  return (
    <Card>
      <SectionTitle aside={<span className="text-xs text-muted">{pending.length} pendiente{pending.length === 1 ? "" : "s"}</span>}>Tus recordatorios</SectionTitle>
      {reminders.length === 0 ? (
        <p className="text-sm text-muted">Escribile a Pulso en el celular, por ejemplo: <em>“acordame en 1 minuto que debo pagar la CCSS”</em>. A esa hora te llama.</p>
      ) : (
        <ul className="space-y-2">
          {pending.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line p-3">
              <span className="text-lg" aria-hidden>⏰</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.task}</div>
                <div className="text-xs text-muted">{dueLabel(r.dueAt)}{r.detail ? ` · ${r.detail}` : ""}</div>
              </div>
              <Button variant="secondary" onClick={() => onAction(r.id, "probar")}>📞 Probar ahora</Button>
              <Button variant="ghost" onClick={() => onAction(r.id, "borrar")}>Borrar</Button>
            </li>
          ))}
          {done.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl bg-stone-50 p-3 text-sm text-muted">
              <span aria-hidden>✓</span>
              <span className="min-w-0 flex-1"><span className="line-through">{r.task}</span> · te llamé {dueLabel(r.firedAt ?? r.dueAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Etiqueta "WhatsApp" para lo que llegó por el WhatsApp Business del negocio. */
function ChannelTag({ channel }: { channel?: string }) {
  if (channel !== "whatsapp") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f8ee] px-2 py-0.5 text-[11px] font-semibold text-[#128c4a]" title="Llegó por WhatsApp">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>
      WhatsApp
    </span>
  );
}

// ---------------------------------------------------------------------------
// Piezas del nuevo orden: número clave, "Hoy", vencimientos y te deben, Tu semana, lo aprendido.
const STEP_NAMES: Record<string, string> = {
  leer: "Leí", extraer: "Facturas y cierres", hacienda: "Hacienda", clasificar: "Ordené", reglas: "Revisé", aprendido: "Lo que me enseñaste", notificar: "WhatsApp",
};

function StatTile({ label, value, hint, onClick, tone }: { label: string; value: string; hint?: string; onClick?: () => void; tone?: "red" }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`rounded-2xl bg-bg/70 px-3 py-2.5 text-left ${onClick ? "transition hover:bg-accent-soft" : ""}`}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`tabular text-lg font-bold leading-tight ${tone === "red" ? "text-red" : ""}`}>{value}</dd>
      {hint && <dd className="text-[11px] text-muted">{hint}</dd>}
    </Tag>
  );
}

function TodayRow({ icon, title, detail, onClick }: { icon: string; title: string; detail: string; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-stone-50">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg text-lg" aria-hidden>{icon}</span>
        <span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="block truncate text-xs text-muted">{detail}</span></span>
        <span className="text-muted" aria-hidden>›</span>
      </button>
    </li>
  );
}

function TodayPanel({ state, onGo }: { state: PulsoState; onGo: (v: View) => void }) {
  const todays = state.reservations.filter((r) => r.date === state.today && r.status !== "cancelada");
  const pendingRem = state.reminders.filter((r) => r.status === "pendiente");
  const nextDue = state.upcoming.find((u) => !u.porCobrar);
  return (
    <Card>
      <SectionTitle>Hoy</SectionTitle>
      <ul className="-mx-2 space-y-0.5">
        <TodayRow icon="🍽️" title={todays.length ? `${todays.length} ${todays.length === 1 ? "mesa" : "mesas"} · ${todays.reduce((t, r) => t + r.people, 0)} personas` : "Sin reservas hoy"} detail={todays[0] ? `Primera: ${todays[0].time ?? "sin hora"} · ${todays[0].name}` : "Ver las próximas reservas"} onClick={() => onGo("reservas")} />
        <TodayRow icon="⏰" title={pendingRem.length ? `${pendingRem.length} ${pendingRem.length === 1 ? "recordatorio" : "recordatorios"}` : "Sin recordatorios"} detail={pendingRem[0] ? pendingRem[0].task : "Escribile a Pulso: “acordame…”"} onClick={() => onGo("whatsapp")} />
        <TodayRow icon="📅" title={nextDue ? `Vence ${nextDue.days === 0 ? "hoy" : `el ${fecha(nextDue.dueDate).slice(0, 5)}`}` : "Nada vence esta semana"} detail={nextDue ? nextDue.label : "Revisá tu plata"} onClick={() => onGo("plata")} />
      </ul>
    </Card>
  );
}

function UpcomingAndReceivables({ state, onOpen }: { state: PulsoState; onOpen: (id: string) => void }) {
  return (
    <>
      <Card>
        <SectionTitle>Vence en 7 días</SectionTitle>
        {state.upcoming.length === 0 ? <p className="text-sm text-muted">Nada en los próximos 7 días.</p> : (
          <ul className="space-y-2 text-sm">
            {state.upcoming.map((u) => (
              <li key={u.emailId} className="flex items-center justify-between gap-3">
                <button className="flex min-w-0 items-center gap-2 text-left hover:underline" onClick={() => onOpen(u.emailId)}><Avatar name={u.counterparty} size={26} /><span className="truncate">{u.label}</span></button>
                <Badge tone={u.days <= 2 ? "red" : "amber"}>{u.days === 0 ? "hoy" : fecha(u.dueDate).slice(0, 5)}</Badge>
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
                <button className="flex min-w-0 items-center gap-2 text-left hover:underline" onClick={() => onOpen(r.emailId)}><Avatar name={r.counterparty} size={26} /><span className="truncate">{r.counterparty}</span></button>
                <span className="tabular shrink-0 font-medium">{colones(r.amount)} <Badge tone={statusTone(r.status)}>{r.status}</Badge></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function WeekCard({ week, busy, onSend }: { week: PulsoState["week"]; busy: boolean; onSend: () => void }) {
  return (
    <Card>
      <SectionTitle aside={<Button variant="ghost" disabled={busy} onClick={onSend}>Enviar por WhatsApp</Button>}>Tu semana</SectionTitle>
      {week.length === 0 ? <p className="text-sm text-muted">No hay nada urgente. ✅</p> : (
        <ol className="space-y-3 text-sm">
          {week.slice(0, 6).map((w, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
              <div className="min-w-0">
                <div className="font-medium">{w.title}{w.amount ? <span className="tabular font-normal text-muted"> · {colones(w.amount)}</span> : null}</div>
                <div className="text-xs text-muted">{w.why}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function LearnedCard({ rules, onForget }: { rules: PulsoState["rules"]; onForget: (id: string) => void }) {
  return (
    <Card>
      <SectionTitle>Lo que me enseñaste</SectionTitle>
      {rules.length === 0 ? (
        <p className="text-sm text-muted">Cuando marqués algo como normal (o respondás “2”), lo recuerdo aquí y dejo de molestarte con eso.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rules.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{r.counterparty} · {r.alertType.replace("_", " ")}</div>
                <div className="text-xs text-muted">{r.reason} · {fecha(r.createdAt)} · desde {r.createdFrom}{r.condition.maxRatio ? ` · hasta ${r.condition.maxRatio}× su promedio` : ""}</div>
              </div>
              <Button variant="ghost" onClick={() => onForget(r.id)}>Olvidar</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
