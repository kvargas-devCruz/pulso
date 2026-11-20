"use client";
// Piezas visuales pequeñas reutilizables.
import type { ReactNode } from "react";

export function colones(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  return (n < 0 ? "-" : "") + "₡" + int.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (dec === "00" ? "" : "," + dec);
}
export function fecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card-soft rounded-3xl bg-surface p-5 ${className}`}>{children}</section>;
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {aside}
    </div>
  );
}

const TONES = {
  red: "bg-red-soft text-red",
  amber: "bg-amber-soft text-amber",
  green: "bg-green-soft text-green",
  gray: "bg-stone-100 text-stone-700",
  accent: "bg-accent-soft text-accent",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function Button({
  children, onClick, variant = "secondary", disabled, type = "button", title,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost"; disabled?: boolean; type?: "button" | "submit"; title?: string;
}) {
  const styles = {
    primary: "bg-accent text-white shadow-sm shadow-accent/30 hover:brightness-110",
    secondary: "border border-line bg-surface text-ink hover:bg-stone-50",
    ghost: "text-muted hover:text-ink hover:bg-stone-100",
  }[variant];
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export function PulseIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12h4l2.5-6 4 12 3-8 1.5 2H22" />
    </svg>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-4xl" : "sm:max-w-2xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1 text-muted hover:bg-stone-100 hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Avatar de una contraparte: iniciales con un color fijo por nombre (paleta categórica
// validada; el color sigue a la entidad, no a su posición en la lista).
const AVATAR_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const AVATAR_SKIP = new Set(["s.a.", "sa", "s.a", "de", "del", "la", "el", "y", "cr", "srl", "ltda", "&"]);

export function initials(name: string): string {
  const words = name.replace(/[.,]/g, " ").split(/\s+/).filter((w) => w && !AVATAR_SKIP.has(w.toLowerCase()));
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
}

export function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ name, size = 36 }: { name: string | null | undefined; size?: number }) {
  const n = name?.trim() || "?";
  const bg = avatarColor(n);
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-xl font-semibold"
      style={{ width: size, height: size, background: bg, color: bg === "#eda100" ? "#0b0b0b" : "#fff", fontSize: Math.round(size * 0.38) }}
    >
      {initials(n)}
    </span>
  );
}
