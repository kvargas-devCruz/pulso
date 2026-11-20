"use client";
// Gráficos de dona en SVG, sin librerías. Reglas de la guía de visualización:
// ≤ 6 partes (el resto va a "Otros"), 2 px de separación entre partes, el color sigue
// a la entidad (nunca al orden), leyenda siempre visible con nombre + monto + %, y
// tooltip al pasar el mouse o enfocar con teclado. Los montos ya vienen calculados por código.
import { useState, type ReactNode } from "react";
import { colones } from "./ui";

export interface DonutSlice { key: string; label: string; amount: number; count: number }

/** Color fijo por categoría (paleta validada para daltonismo, orden fijo). */
export const CATEGORY_COLOR: Record<string, string> = {
  proveedores: "#2a78d6",
  hacienda: "#eb6834",
  ccss: "#1baf7a",
  ins: "#eda100",
  bancos: "#e87ba4",
  ventas: "#008300",
  clientes: "#6250d6",
  contador: "#e34948",
  ruido: "#898781",
  otros: "#898781",
};

/** Medios de pago (orden fijo de la paleta categórica). */
export const METHOD_COLOR: Record<string, string> = { efectivo: "#2a78d6", tarjeta: "#eb6834", sinpe: "#1baf7a" };

/** Colores de estado (reservados): siempre van con su etiqueta, nunca solos. */
export const STATUS_COLOR: Record<string, string> = {
  pagado: "#0ca30c",
  aceptado: "#0ca30c",
  pendiente: "#fab219",
  sin_respuesta: "#fab219",
  vencido: "#d03b3b",
  rechazado: "#d03b3b",
};

/** Monto corto para el centro de la dona (la cifra exacta va en la leyenda). */
export function colonesShort(n: number): string {
  if (n >= 1_000_000) return `₡${(n / 1_000_000).toLocaleString("es-CR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `₡${Math.round(n / 1_000)} mil`;
  return `₡${Math.round(n)}`;
}

const R = 52;
const STROKE = 20;
const C = 2 * Math.PI * R;
const GAP = 2; // px de superficie entre partes

export function Donut({
  title,
  slices,
  colors,
  measure,
  center,
  centerLabel,
  empty = "Sin datos todavía.",
}: {
  title: string;
  slices: DonutSlice[];
  colors: Record<string, string>;
  measure: "amount" | "count";
  center: string;
  centerLabel: string;
  empty?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const value = (s: DonutSlice) => (measure === "amount" ? s.amount : s.count);
  const total = slices.reduce((t, s) => t + value(s), 0);
  const fmt = (s: DonutSlice) => (measure === "amount" ? colones(s.amount) : `${s.count} factura${s.count === 1 ? "" : "s"}`);
  const pct = (s: DonutSlice) => (total ? Math.round((100 * value(s)) / total) : 0);
  const active = slices.find((s) => s.key === hover) ?? null;

  const lens = slices.map((s) => (total ? (value(s) / total) * C : 0));
  const arcs = slices.map((s, i) => {
    const start = lens.slice(0, i).reduce((t, l) => t + l, 0);
    const gap = slices.length > 1 ? Math.min(GAP, lens[i] / 2) : 0;
    return { s, dash: Math.max(lens[i] - gap, 0.001), offset: -start };
  });

  const summary = slices.map((s) => `${s.label}: ${fmt(s)} (${pct(s)} %)`).join("; ");

  return (
    <figure className="flex min-w-0 flex-col items-center gap-3">
      <figcaption className="self-start text-sm font-semibold">{title}</figcaption>
      {total === 0 ? (
        <p className="py-8 text-sm text-muted">{empty}</p>
      ) : (
        <>
          <div className="relative h-36 w-36">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label={`${title}. ${summary}`}>
              <circle cx="70" cy="70" r={R} fill="none" stroke="var(--line)" strokeWidth={STROKE} opacity={0.4} />
              {arcs.map(({ s, dash, offset: off }) => (
                <circle
                  key={s.key}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={colors[s.key] ?? "#898781"}
                  strokeWidth={hover === s.key ? STROKE + 4 : STROKE}
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={off}
                  opacity={hover && hover !== s.key ? 0.35 : 1}
                  className="cursor-pointer transition-[opacity,stroke-width] duration-150"
                  onMouseEnter={() => setHover(s.key)}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              {active ? (
                <>
                  <span className="text-[11px] leading-tight text-muted">{active.label}</span>
                  <span className="tabular text-sm font-semibold leading-tight">{measure === "amount" ? colonesShort(active.amount) : fmt(active)}</span>
                  <span className="tabular text-[11px] text-muted">{pct(active)} %</span>
                </>
              ) : (
                <>
                  <span className="tabular text-sm font-semibold leading-tight">{center}</span>
                  <span className="text-[11px] leading-tight text-muted">{centerLabel}</span>
                </>
              )}
            </div>
          </div>
          <ul className="w-full space-y-1 text-sm">
            {slices.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors ${hover === s.key ? "bg-stone-100" : ""}`}
                  onMouseEnter={() => setHover(s.key)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(s.key)}
                  onBlur={() => setHover(null)}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colors[s.key] ?? "#898781" }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  <span className="tabular text-muted">{measure === "amount" ? colones(s.amount) : s.count}</span>
                  <span className="tabular w-9 text-right text-xs text-muted">{pct(s)} %</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Barras verticales: un solo tono para la magnitud; "Vencido" lleva el color de
// estado crítico y su etiqueta. Tooltip con el monto exacto al pasar el mouse.
export interface BarDatum { key: string; label: string; amount: number; count: number; overdue?: boolean }

export function BarChart({ data, empty = "Nada pendiente.", detail, color = "#2a78d6" }: { data: BarDatum[]; empty?: string; detail?: (d: BarDatum) => string; color?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.amount), 0);
  if (max === 0) return <p className="py-10 text-center text-sm text-muted">{empty}</p>;
  const ticks = [1, 0.5, 0];
  return (
    <div className="relative" role="img" aria-label={data.map((d) => `${d.label}: ${colones(d.amount)}`).join("; ")}>
      <div className="flex h-52 gap-2 sm:gap-3">
        {/* eje y recesivo */}
        <div className="flex w-12 shrink-0 flex-col justify-between pb-6 text-right text-[10px] text-muted tabular">
          {ticks.map((t) => <span key={t}>{colonesShort(max * t)}</span>)}
        </div>
        <div className="relative flex min-w-0 flex-1 items-end gap-2 sm:gap-3">
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {ticks.map((t) => <div key={t} className={`border-t ${t === 0 ? "border-[#c3c2d4]" : "border-dashed border-line"}`} />)}
          </div>
          {data.map((d) => {
            const h = (d.amount / max) * 100;
            const fill = d.overdue ? STATUS_COLOR.vencido : color;
            return (
              <div
                key={d.key}
                className="relative z-10 flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                onMouseEnter={() => setHover(d.key)}
                onMouseLeave={() => setHover(null)}
              >
                {hover === d.key && (
                  <div className="absolute bottom-full z-20 mb-1 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg" style={{ bottom: `calc(${h}% - 0.5rem)` }}>
                    <div className="font-semibold tabular">{colones(d.amount)}</div>
                    <div className="text-white/70">{detail ? detail(d) : `${d.count} cuenta${d.count === 1 ? "" : "s"} · ${d.label.toLowerCase()}`}</div>
                  </div>
                )}
                <div className="flex w-full flex-1 items-end justify-center pb-0">
                  <div
                    className="w-full max-w-9 rounded-t-[4px] transition-opacity"
                    style={{ height: `${Math.max(h, d.amount > 0 ? 2 : 0)}%`, background: fill, opacity: hover && hover !== d.key ? 0.45 : 1 }}
                  />
                </div>
                <div className={`mt-1.5 h-4.5 w-full truncate text-center text-[11px] ${d.overdue ? "font-semibold text-red" : "text-muted"}`}>{d.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de indicador (estilo "Company goals"): ícono de color, monto, nombre y una
// barra de progreso con su significado escrito (nunca solo el color).
export function KpiCard({ icon, tint, value, label, progress, progressLabel, onClick }: {
  icon: ReactNode; tint: string; value: string; label: string; progress: number | null; progressLabel: string; onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`card-soft flex flex-col items-center rounded-2xl bg-surface p-4 text-center ${onClick ? "transition hover:-translate-y-0.5" : ""}`}>
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md" style={{ background: tint, boxShadow: `0 6px 14px -4px ${tint}88` }}>{icon}</span>
      <span className="tabular text-lg font-bold leading-tight">{value}</span>
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-3 w-full">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          {progress !== null && <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: tint }} />}
        </div>
        <div className="mt-1 text-left text-[11px] text-muted">{progressLabel}</div>
      </div>
    </Tag>
  );
}
