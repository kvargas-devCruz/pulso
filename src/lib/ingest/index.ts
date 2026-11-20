// Adaptadores de ingesta (ADR-0001): todos entregan RawEmail[] con el mismo formato.
import { promises as fs } from "fs";
import path from "path";
import type { RawEmail } from "../types";

export interface SourceAdapter {
  source: RawEmail["source"];
  label: string;
  fetchEmails(): Promise<RawEmail[]>;
}

interface DemoFile {
  id: string;
  remitente: string;
  para: string;
  fecha: string;
  asunto: string;
  cuerpo: string;
  adjuntos: { nombre: string; tipo: string; contenido: string | null }[];
}

export const DEMO_LOTES = ["lote-1", "lote-2"] as const;
export type DemoLote = (typeof DEMO_LOTES)[number];

/** Bandeja de prueba: data/bandeja-prueba/<lote>/*.json (empresa ficticia). */
export function demoAdapter(lote: DemoLote, baseDir = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "bandeja-prueba")): SourceAdapter {
  return {
    source: "demo",
    label: lote,
    async fetchEmails() {
      const dir = path.join(/*turbopackIgnore: true*/ baseDir, lote);
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
      return Promise.all(
        files.map(async (f) => {
          const d = JSON.parse(await fs.readFile(path.join(/*turbopackIgnore: true*/ dir, f), "utf8")) as DemoFile;
          return {
            externalId: d.id,
            source: "demo" as const,
            sender: d.remitente,
            subject: d.asunto,
            body: d.cuerpo,
            receivedAt: d.fecha,
            attachments: d.adjuntos.map((a) => ({ name: a.nombre, type: a.tipo, content: a.contenido })),
          };
        }),
      );
    },
  };
}

/**
 * Gmail (OAuth, scopes gmail.readonly + gmail.compose; ADR-0004).
 * Misma interfaz que la demo. Pendiente para el domingo: implementar con la Gmail API.
 */
export function gmailAdapter(): SourceAdapter {
  return {
    source: "gmail",
    label: "gmail",
    async fetchEmails() {
      throw new Error("La conexión con Gmail todavía no está configurada. Usá la bandeja de prueba.");
    },
  };
}
