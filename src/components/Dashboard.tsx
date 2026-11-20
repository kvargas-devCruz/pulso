"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { PulsoState } from "@/lib/state";
import { Avatar, Badge, Button, Card, PulseIcon, SectionTitle, colones, fecha, type Tone } from "./ui";
import { AskPulso, LiveRun, type LiveAlert, type LiveRunState } from "./Agent";
import { EvidenceModal, EmailModal, DraftModal } from "./Modals";
import { Phone } from "./Phone";
import { BarChart, CATEGORY_COLOR, Donut, KpiCard, METHOD_COLOR, STATUS_COLOR, colonesShort } from "./Charts";

type AlertView = PulsoState["alerts"][number];
type DocView = PulsoState["documents"][number];
type View = "inicio" | "correo" | "plata";

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
  const [view, setView] = useState<View>("inicio");
  const [cat, setCat] = useState<string>("todos");
  const [live, setLive] = useState<LiveRunState | null>(null);

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
  const upcomingTotal = state.upcoming.filter((u) => !u.porCobrar).reduce((t, u) => t + (u.amount ?? 0), 0);
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
      const r = await api<{ run: { steps: { step: string; detail: string }[]; headline: string }; alerts: LiveAlert[] }>(
        "/api/ingest", { method: "POST", body: JSON.stringify({ source: "demo", lote }) });
      setLive({ label, steps: r.run.steps, alerts: r.alerts, headline: r.run.headline });
      // El panel se actualiza cuando termina la animación (≈ 420 ms por paso).
      setTimeout(() => { refresh().catch(() => undefined); }, r.run.steps.length * 420 + 150);
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

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6">
      {/* Barra superior (logo · navegación · empresa y acciones) */}
      <header className="card-soft mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-3xl bg-surface px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7b6ff0] to-[#4a3fd0] text-white shadow-md shadow-accent/30">
            <PulseIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight">Pulso</h1>
            <p className="hidden text-xs text-muted sm:block">El estado de tu empresa, leído de tu correo</p>
          </div>
        </div>

        {!empty && (
          <nav aria-label="Secciones" className="order-last flex w-full justify-around gap-1 border-t border-line pt-2 md:order-none md:w-auto md:flex-1 md:justify-center md:border-0 md:pt-0">
            {NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                aria-current={view === n.key ? "page" : undefined}
                className={`group relative flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${view === n.key ? "text-accent" : "text-muted hover:text-ink"}`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${view === n.key ? "bg-accent-soft" : "group-hover:bg-stone-100"}`}>{n.icon}</span>
                {n.label}
                {n.key === "inicio" && open.length > 0 && <span className="absolute right-3 top-1 h-2 w-2 rounded-full bg-red ring-2 ring-surface" aria-label={`${open.length} alertas abiertas`} />}
              </button>
            ))}
          </nav>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="mr-1 text-sm sm:text-right">
            <div className="font-medium">{state.company.name}</div>
            <div className="text-xs text-muted">Hoy: {fecha(state.today)}</div>
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
            <Button variant="ghost" disabled={!!busy} onClick={() => confirm("¿Reiniciar la demo? Se borran los datos de prueba.") && (setLive(null), act("reset", () => api("/api/reset", { method: "POST" }), "Demo reiniciada."))}>
              Reiniciar
            </Button>
          )}
        </div>
      </header>

      <div className="mb-5 flex flex-wrap gap-2 px-1 text-xs">
        <Badge tone={state.mode.claude ? "green" : "gray"}>{state.mode.claude ? "Claude activo" : "Extracción sin Claude (heurística)"}</Badge>
        <Badge tone={state.mode.whatsapp ? "green" : "gray"}>{state.mode.whatsapp ? "WhatsApp real (Twilio)" : "WhatsApp simulado"}</Badge>
        <Badge tone={state.mode.store === "supabase" ? "green" : "gray"}>{state.mode.store === "supabase" ? "Supabase" : "Datos locales"}</Badge>
        <Badge tone="gray">Gmail: solo lectura + borradores · nunca envía</Badge>
      </div>

      {empty && live ? (
        <div className="mx-auto max-w-xl"><LiveRun run={live} onClose={() => setLive(null)} onOpenAlert={openAlert} /></div>
      ) : empty ? (
        <EmptyState busy={busy === "lote-1"} onStart={() => ingest("lote-1")} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          {view === "correo" && cat !== "todos" ? (
            <div className="min-w-0 space-y-5">
              <MailTabs categories={state.categories} cat={cat} onPick={setCat} />
              <CategoryView
                category={state.categories.find((c) => c.category === cat) ?? state.categories[0]}
                docs={state.documents.filter((d) => d.category === cat)}
                onOpen={setEmailId}
                onBack={() => setCat("todos")}
              />
            </div>
          ) : (
          <div className="min-w-0 space-y-5">
            {view === "correo" && <MailTabs categories={state.categories} cat={cat} onPick={setCat} />}

            {/* Bitácora del agente (animada mientras trabaja) */}
            {view === "inicio" && live && <LiveRun run={live} onClose={() => setLive(null)} onOpenAlert={openAlert} />}
            {view === "inicio" && !live && state.lastRun && (
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

            {view === "inicio" && (<>
            {/* Semáforo */}
            <Card className={`${L.soft} border-transparent`}>
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-4">
                  <span className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${L.dot}`} aria-label={`Semáforo en ${L.label}`}>
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

            {/* Indicadores (estilo "Company goals") */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <div className="col-span-2 grid sm:col-span-1">
                <KpiCard
                  tint="#008300"
                  icon={<IconTrend />}
                  value={colonesShort(weekSalesTotal)}
                  label="Ventas de la semana"
                  progress={weekSalesTotal ? (100 * weekCard) / weekSalesTotal : null}
                  progressLabel={weekSales.length ? `${Math.round((100 * weekCard) / weekSalesTotal)} % con tarjeta · ${weekSales.length} cierres` : "sin cierres de caja"}
                  onClick={() => setView("plata")}
                />
              </div>
              <KpiCard
                tint="#2a78d6"
                icon={<IconWallet />}
                value={colonesShort(owed)}
                label="Por pagar"
                progress={owed + paidTotal ? (100 * paidTotal) / (owed + paidTotal) : null}
                progressLabel={`${owed + paidTotal ? Math.round((100 * paidTotal) / (owed + paidTotal)) : 0} % ya pagado`}
                onClick={() => setView("plata")}
              />
              <KpiCard
                tint="#1baf7a"
                icon={<IconHand />}
                value={colonesShort(receivableTotal)}
                label="Te deben"
                progress={receivableTotal ? (100 * receivableOverdue) / receivableTotal : null}
                progressLabel={receivableOverdue ? `${colonesShort(receivableOverdue)} ya vencido` : "nada vencido"}
              />
              <KpiCard
                tint="#d03b3b"
                icon={<IconAlert />}
                value={colonesShort(state.semaphore.moneyAtRisk)}
                label="Dinero en riesgo"
                progress={owed + receivableTotal ? (100 * state.semaphore.moneyAtRisk) / (owed + receivableTotal) : null}
                progressLabel={`en ${open.length} alerta${open.length === 1 ? "" : "s"} abierta${open.length === 1 ? "" : "s"}`}
              />
              <KpiCard
                tint="#6250d6"
                icon={<IconCalendar />}
                value={colonesShort(upcomingTotal)}
                label="Vence en 7 días"
                progress={owed ? (100 * upcomingTotal) / owed : null}
                progressLabel={`${state.semaphore.upcomingCount} vencimiento${state.semaphore.upcomingCount === 1 ? "" : "s"}`}
                onClick={() => setView("plata")}
              />
            </div>

            </>)}

            {view === "plata" && (<>
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

            <Card>
              <SectionTitle aside={<span className="text-xs text-muted">sin contar lo ya pagado</span>}>Lo que vence, por semana</SectionTitle>
              <BarChart data={state.charts.dueByWeek} empty="No tenés nada pendiente de pagar. ✅" />
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
                  <Donut
                    title="Cómo te pagan"
                    slices={state.charts.salesByMethod}
                    colors={METHOD_COLOR}
                    measure="amount"
                    center={colonesShort(state.charts.salesByMethod.reduce((t, m) => t + m.amount, 0))}
                    centerLabel="vendido"
                  />
                </div>
              )}
            </Card>

            </>)}

            {view === "inicio" && (<>
            <AskPulso suggestions={state.suggestions} onOpenEmail={setEmailId} />

            {/* Alertas: un feed de "esto necesita tu revisión" */}
            <Card>
              <SectionTitle aside={open.length ? <span className="rounded-full bg-red-soft px-2.5 py-0.5 text-xs font-semibold text-red">{open.length} para revisar</span> : null}>Lo que no cuadra</SectionTitle>
              {open.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl bg-green-soft px-6 py-8 text-center">
                  <span className="mb-2 text-3xl" aria-hidden>✅</span>
                  <p className="font-semibold text-green">Nada para revisar hoy</p>
                  <p className="mt-1 text-sm text-muted">Sigo vigilando tu correo. Si llega algo raro, te aviso por WhatsApp.</p>
                </div>
              ) : (
                <ul className="space-y-3">
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
                        <span className="flex items-center gap-2"><Avatar name={a.counterparty} size={22} /><span>{a.title} · {a.counterparty} · {colones(a.amountAtRisk)}</span></span>
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
                        <button className="flex items-center gap-2 text-left hover:underline" onClick={() => setEmailId(u.emailId)}><Avatar name={u.counterparty} size={26} />{u.label}</button>
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
                        <button className="flex items-center gap-2 text-left hover:underline" onClick={() => setEmailId(r.emailId)}><Avatar name={r.counterparty} size={26} />{r.counterparty}</button>
                        <span className="tabular font-medium">{colones(r.amount)} <Badge tone={statusTone(r.status)}>{r.status}</Badge></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
            </>)}

            {view === "correo" && (<>
            {/* Categorías */}
            <Card>
              <SectionTitle>Tu correo, ordenado</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {state.categories.filter((c) => c.count > 0).map((c) => (
                  <button key={c.category} type="button" onClick={() => setCat(c.category)} className="rounded-xl border border-line p-3 text-left transition-colors hover:border-ink/30 hover:bg-stone-50">
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
                        <td className="px-5 py-2"><div className="flex items-center gap-2.5"><Avatar name={d.counterparty ?? d.from} size={30} /><div><div className="font-medium">{d.counterparty ?? d.from}</div><div className="text-xs text-muted">{fecha(d.receivedAt)}</div></div></div></td>
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
            </>)}
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
  const porCobrar = a.type === "vencido" && a.meta.porCobrar;
  return (
    <li className={`rounded-2xl border bg-surface p-4 transition hover:shadow-md ${a.confidence === "alta" ? "border-red/20" : "border-line"}`}>
      <div className="flex items-start gap-3">
        <Avatar name={a.counterparty} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{a.title}</span>
                <Badge tone={confTone(a.confidence)}>confianza {a.confidence}</Badge>
                {a.notified && <Badge tone="green">avisado por WhatsApp</Badge>}
              </div>
              <div className="text-sm text-muted">{a.counterparty}</div>
            </div>
            {a.amountAtRisk ? (
              <div className="text-right">
                <div className="tabular text-lg font-bold leading-tight">{colones(a.amountAtRisk)}</div>
                <div className="text-[11px] text-muted">{porCobrar ? "por cobrar" : "en riesgo"}</div>
              </div>
            ) : null}
          </div>
          <p className="mt-2 text-sm">{a.explanation}</p>
          <p className="mt-1 text-xs text-muted">Por qué: {a.reason}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {approved ? (
              <Button variant="primary" onClick={onDraft}>✓ Correo listo · ver</Button>
            ) : (
              <Button variant="primary" disabled={busy === a.id + "ap"} onClick={onApprove}>{a.type === "vencido" && !porCobrar ? "Crear recordatorio" : "Preparar correo"}</Button>
            )}
            <Button onClick={onEvidence}>Ver evidencia</Button>
            <span className="ml-auto flex gap-1">
              {canNormal && <Button variant="ghost" disabled={busy === a.id + "no"} onClick={onNormal}>Es normal</Button>}
              <Button variant="ghost" onClick={onDismiss}>Descartar</Button>
            </span>
          </div>
        </div>
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
            <button onClick={onBack} className="mb-1 text-xs text-muted hover:text-ink hover:underline">← Todo el correo</button>
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
                <Avatar name={d.counterparty ?? d.from} size={36} />
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

// ---------------------------------------------------------------------------
// Navegación e íconos (trazo simple, heredan el color del texto).
const ico = "h-[18px] w-[18px]";
const Svg = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const IconHome = () => <Svg d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" />;
const IconMail = () => <Svg d="M3 6h18v12H3zM3 7l9 6 9-6" />;
const IconChart = () => <Svg d="M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z" />;
const IconWallet = () => <Svg d="M3 7h15a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-3v3M16 13h2" />;
const IconHand = () => <Svg d="M4 14h3l4 3h5a2 2 0 0 0 0-4h-4M7 14V9l5-4 5 4M2 20h20" />;
const IconAlert = () => <Svg d="M12 3l10 18H2zM12 10v5M12 18h.01" />;
const IconTrend = () => <Svg d="M3 17l6-6 4 4 8-8M15 7h6v6" />;
const IconCalendar = () => <Svg d="M4 6h16v15H4zM4 10h16M9 3v4M15 3v4" />;

const NAV: { key: View; label: string; icon: ReactNode }[] = [
  { key: "inicio", label: "Inicio", icon: <IconHome /> },
  { key: "correo", label: "Correo", icon: <IconMail /> },
  { key: "plata", label: "Plata", icon: <IconChart /> },
];

function MailTabs({ categories, cat, onPick }: { categories: PulsoState["categories"]; cat: string; onPick: (c: string) => void }) {
  const total = categories.reduce((t, c) => t + c.count, 0);
  const tabs = [{ key: "todos", label: "Todo", count: total }, ...categories.filter((c) => c.count > 0).map((c) => ({ key: c.category as string, label: c.label, count: c.count }))];
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
