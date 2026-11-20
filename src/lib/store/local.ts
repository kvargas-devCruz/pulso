// Almacenamiento local en un archivo JSON (.data/pulso.json). Solo para desarrollo y demo:
// en Vercel el disco no es persistente, por eso en producción se usa Supabase.
import { promises as fs } from "fs";
import path from "path";
import type { Action, Alert, Company, EmailRecord, Extraction, LearnedRule, Run, WhatsAppMessage } from "../types";
import { DEFAULT_COMPANY, type Store } from "./types";

interface DB {
  company: Company;
  emails: EmailRecord[];
  extractions: Extraction[];
  alerts: Alert[];
  rules: LearnedRule[];
  actions: Action[];
  messages: WhatsAppMessage[];
  runs: Run[];
}

const empty = (): DB => ({ company: { ...DEFAULT_COMPANY }, emails: [], extractions: [], alerts: [], rules: [], actions: [], messages: [], runs: [] });

function upsertBy<T>(list: T[], items: T[], key: (x: T) => string): T[] {
  const map = new Map(list.map((x) => [key(x), x]));
  for (const it of items) map.set(key(it), it);
  return [...map.values()];
}

export class LocalStore implements Store {
  kind = "local" as const;
  private file: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir = process.env.PULSO_DATA_DIR || (process.env.VERCEL ? "/tmp/pulso" : path.join(/*turbopackIgnore: true*/ process.cwd(), ".data"))) {
    this.file = path.join(dir, "pulso.json");
  }

  private async read(): Promise<DB> {
    try {
      return { ...empty(), ...JSON.parse(await fs.readFile(this.file, "utf8")) };
    } catch {
      return empty();
    }
  }
  private async write(db: DB) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.rename(tmp, this.file);
  }
  /** Serializa las escrituras para no pisar cambios entre peticiones concurrentes. */
  private mutate(fn: (db: DB) => void | Promise<void>): Promise<void> {
    const run = this.queue.then(async () => {
      const db = await this.read();
      await fn(db);
      await this.write(db);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async getCompany() { return (await this.read()).company; }
  saveCompany(c: Company) { return this.mutate((db) => { db.company = c; }); }

  async listEmails() { return (await this.read()).emails; }
  async addEmails(emails: EmailRecord[]) {
    const added: EmailRecord[] = [];
    await this.mutate((db) => {
      const seen = new Set(db.emails.map((e) => `${e.source}:${e.externalId}`));
      for (const e of emails) {
        if (seen.has(`${e.source}:${e.externalId}`)) continue;
        seen.add(`${e.source}:${e.externalId}`);
        db.emails.push(e);
        added.push(e);
      }
    });
    return added;
  }

  async listExtractions() { return (await this.read()).extractions; }
  upsertExtractions(list: Extraction[]) { return this.mutate((db) => { db.extractions = upsertBy(db.extractions, list, (x) => x.emailId); }); }

  async listAlerts() { return (await this.read()).alerts; }
  upsertAlerts(list: Alert[]) { return this.mutate((db) => { db.alerts = upsertBy(db.alerts, list, (x) => x.id); }); }

  async listRules() { return (await this.read()).rules; }
  upsertRule(r: LearnedRule) { return this.mutate((db) => { db.rules = upsertBy(db.rules, [r], (x) => x.id); }); }
  deleteRule(id: string) { return this.mutate((db) => { db.rules = db.rules.filter((r) => r.id !== id); }); }

  async listActions() { return (await this.read()).actions; }
  upsertAction(a: Action) { return this.mutate((db) => { db.actions = upsertBy(db.actions, [a], (x) => x.id); }); }

  async listMessages() { return (await this.read()).messages; }
  addMessage(m: WhatsAppMessage) { return this.mutate((db) => { db.messages.push(m); }); }

  async listRuns() { return (await this.read()).runs; }
  saveRun(r: Run) { return this.mutate((db) => { db.runs = upsertBy(db.runs, [r], (x) => x.id); }); }

  reset() { return this.mutate((db) => { Object.assign(db, empty()); }); }
}
