/**
 * Store Flow: rodada salva no servidor (antes so no navegador).
 *
 * - latest(): ultima rodada do servidor; se nao houver servidor ativo,
 *   continua com a copia local (localStorage), como antes.
 * - push(run): grava aprovacoes/edicoes (com espera curta para juntar
 *   cliques seguidos). O estado aparece na tela: salvo / salvando / erro.
 */
import { ref } from "vue";
import { createHttpClient } from "@/data/adapters/http-client";
import { loadSavedRun, parseRun, saveRun, type ReviewRun } from "./review-queue";

const RUN_ID_KEY = "operaia.store-flow.run-id";
const http = createHttpClient();

export type SyncState = "idle" | "saving" | "saved" | "error" | "local-only";
export const syncState = ref<SyncState>("idle");
export const syncError = ref<string | null>(null);

function readRunId(): string | null {
  try {
    return localStorage.getItem(RUN_ID_KEY);
  } catch {
    return null;
  }
}

function writeRunId(id: string | null): void {
  try {
    if (id) localStorage.setItem(RUN_ID_KEY, id);
    else localStorage.removeItem(RUN_ID_KEY);
  } catch {
    /* sem armazenamento local */
  }
}

let runId: string | null = readRunId();

export function setRunId(id: string | null): void {
  runId = id;
  writeRunId(id);
  syncState.value = id ? "saved" : "local-only";
}

/** Ultima rodada: servidor primeiro, copia local se o servidor nao tiver. */
export async function latestRun(): Promise<ReviewRun | null> {
  try {
    const res = await http.get<{ runId: string | null; run: unknown; saved: boolean }>("/store-flow/runs/latest");
    if (res.runId && res.run) {
      const run = parseRun(JSON.stringify(res.run));
      setRunId(res.runId);
      saveRun(run);
      return run;
    }
    if (!res.saved) syncState.value = "local-only";
  } catch {
    syncState.value = "local-only";
  }
  return loadSavedRun();
}

let timer: ReturnType<typeof setTimeout> | null = null;
let importing = false;

/** Rodada aberta de arquivo .json passa a ser a rodada do servidor. */

export async function importRun(run: ReviewRun): Promise<void> {
  saveRun(run);
  importing = true;
  if (timer) clearTimeout(timer);
  try {
    const res = await http.post<{ runId: string }>("/store-flow/runs/import", { run });
    setRunId(res.runId);
  } catch (err) {
    setRunId(null);
    syncError.value = err instanceof Error ? err.message : "Não foi possível salvar no servidor.";
  } finally {
    importing = false;
  }
}

/** Grava o estado atual (aprovado/recusado/edicoes). */
export function pushRun(run: ReviewRun | null): void {
  saveRun(run);
  // Durante uma importacao a rodada nova ja vai inteira no POST: nao
  // sobrescrever a rodada anterior com ela.
  if (!run || !runId || importing) return;
  if (timer) clearTimeout(timer);
  syncState.value = "saving";
  const id = runId;
  timer = setTimeout(async () => {
    if (importing || id !== runId) return;
    try {
      await http.put(`/store-flow/runs/${id}`, { run });
      syncState.value = "saved";
      syncError.value = null;
    } catch (err) {
      syncState.value = "error";
      syncError.value = err instanceof Error ? err.message : "Não foi possível salvar no servidor.";
    }
  }, 600);
}

export const SYNC_LABEL: Record<SyncState, string> = {
  idle: "",
  saving: "Salvando…",
  saved: "✓ Salvo no servidor — abre igual em qualquer aparelho",
  error: "Não salvou no servidor — tente de novo",
  "local-only": "Salvo só neste navegador",
};
