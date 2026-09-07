/**
 * Automacoes externas (n8n) — andar de Automacao (P1.21 extensao).
 *
 * Nao usa o runtime de missoes do office (sem risk/autonomy/employee):
 * e um espelho fino da API publica do n8n, pra o andar mostrar
 * status real e permitir ligar/desligar sem abrir o n8n. Config via
 * env (N8N_API_URL / N8N_API_KEY) — sem elas, listExternalAutomations
 * retorna N8N_NOT_CONFIGURED em vez de fingir lista vazia.
 */

import { DomainError } from "@operaia/shared";

export class N8nNotConfiguredError extends DomainError {
  readonly code = "N8N_NOT_CONFIGURED";
  readonly httpStatus = 503;

  constructor() {
    super("N8N_API_URL/N8N_API_KEY nao configurados no ambiente.");
  }
}

export interface ExternalAutomation {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly updatedAt: string;
  readonly editorUrl: string;
}

interface N8nWorkflow {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly updatedAt: string;
}

function n8nConfig(): { apiUrl: string; apiKey: string; editorBaseUrl: string } {
  const apiUrl = process.env.N8N_API_URL;
  const apiKey = process.env.N8N_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new N8nNotConfiguredError();
  }
  const editorBaseUrl = process.env.N8N_EDITOR_URL ?? "https://n8n.operaia.com.br";
  return { apiUrl, apiKey, editorBaseUrl };
}

async function n8nFetch(path: string, init?: RequestInit): Promise<unknown> {
  const { apiUrl, apiKey } = n8nConfig();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      "X-N8N-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `n8n API ${response.status} em ${path}: ${await response.text().catch(() => "")}`,
    );
  }
  return response.json();
}

function toExternalAutomation(
  workflow: N8nWorkflow,
  editorBaseUrl: string,
): ExternalAutomation {
  return {
    id: workflow.id,
    name: workflow.name,
    active: workflow.active,
    updatedAt: workflow.updatedAt,
    editorUrl: `${editorBaseUrl}/workflow/${workflow.id}`,
  };
}

export async function listExternalAutomations(): Promise<ExternalAutomation[]> {
  const { editorBaseUrl } = n8nConfig();
  const body = (await n8nFetch("/workflows")) as { data: N8nWorkflow[] };
  return body.data.map((workflow) => toExternalAutomation(workflow, editorBaseUrl));
}

export async function setExternalAutomationActive(
  id: string,
  active: boolean,
): Promise<ExternalAutomation> {
  const { editorBaseUrl } = n8nConfig();
  const workflow = (await n8nFetch(`/workflows/${id}/${active ? "activate" : "deactivate"}`, {
    method: "POST",
  })) as N8nWorkflow;
  return toExternalAutomation(workflow, editorBaseUrl);
}
