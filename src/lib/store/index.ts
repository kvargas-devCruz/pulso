import { LocalStore } from "./local";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

let store: Store | null = null;

/** Supabase si hay llaves configuradas; si no, almacenamiento local para la demo. */
export function getStore(): Store {
  if (store) return store;
  const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  store = hasSupabase && process.env.PULSO_STORE !== "local" ? new SupabaseStore() : new LocalStore();
  return store;
}

export type { Store } from "./types";
