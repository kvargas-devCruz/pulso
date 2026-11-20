// npm run eval — procesa la bandeja de prueba de punta a punta y la compara contra esperado.json.
// Es el "agente que verifica su propio trabajo": se corre después de cambiar el motor o los prompts.
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { LocalStore } from "../src/lib/store/local";
import { demoAdapter } from "../src/lib/ingest";
import { runIngest, markNormal } from "../src/lib/engine/pipeline";
import { buildState } from "../src/lib/state";
import { claudeEnabled } from "../src/lib/engine/claude";

interface ExpectedEmail {
  id: string; lote: string; categoria: string; tipo: string; monto: number | null; vencimiento: string | null;
  estado?: string; estado_hacienda?: string;
}
interface ExpectedAlert { tipo: string; confianza: string; correos: string[] }

const base = path.join(process.cwd(), "data", "bandeja-prueba");
const ok = (b: boolean) => (b ? "✅" : "❌");
const normEstado = (s?: string) => (s ?? "").replace(" (contado)", "");

async function main() {
  const expected = JSON.parse(await fs.readFile(path.join(base, "esperado.json"), "utf8"));
  const today: string = expected.hoy;
  process.env.PULSO_TODAY = today;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pulso-eval-"));
  const store = new LocalStore(dir);

  console.log(`\nPulso · eval · hoy ${today} · extracción de texto: ${claudeEnabled() ? "Claude" : "heurística (sin API key)"}\n`);

  // ---------------- Lote 1
  const r1 = await runIngest(store, demoAdapter("lote-1", base), today);
  console.log(`Lote 1 → ${r1.run.headline}`);

  // ---------------- Extracción
  const exts = new Map((await store.listExtractions()).map((x) => [x.emailId.replace(/^demo-/, ""), x]));
  const fields = { categoria: 0, tipo: 0, monto: 0, vencimiento: 0, estado: 0, hacienda: 0 };
  let total = 0, haciendaTotal = 0;
  const diffs: string[] = [];
  const lote1 = (expected.correos as ExpectedEmail[]).filter((c) => c.lote === "lote-1");
  for (const e of lote1) {
    const x = exts.get(e.id);
    total++;
    if (!x) { diffs.push(`${e.id}: no se extrajo`); continue; }
    const checks: [keyof typeof fields, boolean, string][] = [
      ["categoria", x.category === e.categoria, `${x.category} ≠ ${e.categoria}`],
      ["tipo", x.kind === e.tipo, `${x.kind} ≠ ${e.tipo}`],
      ["monto", (x.amount ?? null) === null ? e.monto === null : e.monto !== null && Math.abs(x.amount! - e.monto) < 0.01, `${x.amount} ≠ ${e.monto}`],
      ["vencimiento", (x.dueDate ?? null) === (e.vencimiento ?? null), `${x.dueDate} ≠ ${e.vencimiento}`],
      ["estado", e.estado === undefined || x.status === normEstado(e.estado), `${x.status} ≠ ${e.estado}`],
    ];
    for (const [f, pass, msg] of checks) {
      if (pass) fields[f]++;
      else diffs.push(`${e.id} (${f}): ${msg}`);
    }
    if (e.estado_hacienda) {
      haciendaTotal++;
      if (x.haciendaStatus === e.estado_hacienda) fields.hacienda++;
      else diffs.push(`${e.id} (hacienda): ${x.haciendaStatus} ≠ ${e.estado_hacienda}`);
    }
  }
  const pct = (n: number, d: number) => `${n}/${d} (${Math.round((100 * n) / d)}%)`;
  console.log("\nExtracción (lote 1)");
  console.log(`  categoría    ${pct(fields.categoria, total)}`);
  console.log(`  tipo         ${pct(fields.tipo, total)}`);
  console.log(`  monto        ${pct(fields.monto, total)}`);
  console.log(`  vencimiento  ${pct(fields.vencimiento, total)}`);
  console.log(`  estado       ${pct(fields.estado, total)}`);
  console.log(`  Hacienda     ${pct(fields.hacienda, haciendaTotal)}`);

  // ---------------- Alertas después del lote 1
  const expAlerts = (expected.alertas as ExpectedAlert[]);
  const matchAlerts = async (list: ExpectedAlert[]) => {
    const alerts = (await store.listAlerts()).map((a) => ({ ...a, ids: a.emailIds.map((i) => i.replace(/^demo-/, "")) }));
    const used = new Set<string>();
    const found = list.map((e) => {
      const m = alerts.find((a) => !used.has(a.id) && a.type === e.tipo && a.confidence === e.confianza && e.correos.every((c) => a.ids.includes(c)));
      if (m) used.add(m.id);
      return { e, m };
    });
    const extra = alerts.filter((a) => !used.has(a.id));
    return { found, extra };
  };

  const l1Expected = expAlerts.filter((a) => a.correos.every((c) => c.startsWith("lote-1")));
  const m1 = await matchAlerts(l1Expected);
  console.log("\nAlertas (lote 1)");
  for (const { e, m } of m1.found) console.log(`  ${ok(!!m)} ${e.tipo} · ${e.confianza} · ${e.correos[0]}`);
  for (const x of m1.extra) console.log(`  ⚠️  falso positivo: ${x.type} · ${x.confidence} · ${x.ids.join(", ")}`);
  let state = await buildState(store, today);
  console.log(`  semáforo: ${state.semaphore.light} (esperado ${expected.semaforo.despues_lote_1}) — "${state.semaphore.phrase}"`);
  const reviewOk = (expected.revisar as { correo: string }[]).every((r) => state.review.some((x) => x.emailId === "demo-" + r.correo));
  console.log(`  ${ok(reviewOk)} "revisar" (sin respuesta de Hacienda)`);

  // ---------------- Enseñar: Maderas El Pinar es normal
  const pinar = (await store.listAlerts()).find((a) => a.type === "monto_inusual" && a.confidence === "media");
  if (pinar) await markNormal(store, pinar.id, "whatsapp", "Temporada navideña");
  console.log(`\nEnseñanza: "${pinar?.counterparty}" marcado como normal ${ok(!!pinar)}`);

  // ---------------- Lote 2
  const r2 = await runIngest(store, demoAdapter("lote-2", base), today);
  console.log(`Lote 2 → ${r2.run.headline}`);
  const all = await matchAlerts(expAlerts);
  const dup = all.found.find(({ e }) => e.tipo === "duplicado" && e.confianza === "alta");
  console.log(`  ${ok(!!dup?.m && dup.m.status === "abierta")} duplicado exacto (flujo principal)`);
  const learnedId = (expected.sin_alerta_si_se_enseno as { correo: string }[])[0].correo;
  const learnedAlert = (await store.listAlerts()).find((a) => a.emailIds[0] === "demo-" + learnedId);
  console.log(`  ${ok(learnedAlert?.status === "normal_aprendido")} ${learnedId} quedó como normal_aprendido (no notificó)`);
  console.log(`  ${ok(!!r2.notified && r2.notified.alertId === dup?.m?.id)} WhatsApp de la alerta del duplicado (${r2.notified?.status ?? "sin mensaje"})`);
  state = await buildState(store, today);
  console.log(`  semáforo: ${state.semaphore.light} (esperado ${expected.semaforo.despues_lote_2})`);

  const detected = all.found.filter((f) => f.m).length;
  const fp = all.extra.filter((x) => !(x.emailIds[0] === "demo-" + learnedId)).length;
  console.log(`\nResumen: ${detected}/${expAlerts.length} alertas plantadas detectadas · ${fp} falsos positivos`);
  if (diffs.length) {
    console.log("\nDiferencias de extracción:");
    diffs.forEach((d) => console.log("  - " + d));
  }
  await fs.rm(dir, { recursive: true, force: true });
  const allFields = Object.values(fields).reduce((s, n) => s + n, 0);
  const allTotal = total * 5 + haciendaTotal;
  console.log(`\nPrecisión de extracción: ${Math.round((100 * allFields) / allTotal)}%\n`);
  if (detected < expAlerts.length || fp > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
