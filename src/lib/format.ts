// Formato para Costa Rica: colones con espacio de miles y coma decimal; fechas dd/mm/aaaa.

export function colones(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  const withSpaces = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (n < 0 ? "-" : "") + "₡" + withSpaces + (dec === "00" ? "" : "," + dec);
}

export function fecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Diferencia en días entre dos fechas YYYY-MM-DD (b - a). */
export function daysBetween(a: string, b: string): number {
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((db - da) / 86_400_000);
}

/** "Hoy" de Pulso: PULSO_TODAY o la fecha actual en Costa Rica. */
export function todayCR(): string {
  if (process.env.PULSO_TODAY) return process.env.PULSO_TODAY;
  const now = new Date(Date.now() - 6 * 3600_000); // UTC-6, sin horario de verano
  return now.toISOString().slice(0, 10);
}

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}
