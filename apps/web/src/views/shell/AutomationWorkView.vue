<script setup lang="ts">
/**
 * Clientes (Atlas) — pipeline por cliente do Automation Specialist,
 * mesma logica do Mercurio (MarketingWorkView.vue): nicho + briefing
 * entram, o Cerebro do Nicho acumula conhecimento real entre clientes
 * do mesmo setor, cada etapa e uma chamada real de LLM (ver apps/api
 * automation-engagements), sem conteudo estatico/fake.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { createCrmClient, type ClientSummary, type NicheSummary } from "@/data/adapters/crm-client";
import {
  AUTOMATION_STAGE_LABEL,
  AUTOMATION_STAGE_ORDER,
  createAutomationEngagementsClient,
  type AutomationEngagement,
  type AutomationStageId,
} from "@/data/adapters/automation-engagements-client";

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
const client = createAutomationEngagementsClient();
const crm = createCrmClient();

const listState = ref<"idle" | "loading" | "ready" | "error">("idle");
const listError = ref<string | null>(null);
const engagements = ref<readonly AutomationEngagement[]>([]);
const activeId = ref<string | null>(null);
const active = computed(() => engagements.value.find((e) => e.id === activeId.value) ?? null);

const niche = ref("");
const briefing = ref("");
const clientName = ref("");
const niches = ref<readonly NicheSummary[]>([]);
const clients = ref<readonly ClientSummary[]>([]);
const submitting = ref(false);
const submitError = ref<string | null>(null);

const attachmentFile = ref<File | null>(null);
const attachmentBase64 = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

function onAttachmentChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  submitError.value = null;
  if (!file) {
    attachmentFile.value = null;
    attachmentBase64.value = null;
    return;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    submitError.value = "Anexo muito grande — o limite é 4MB.";
    input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    attachmentBase64.value = result.split(",")[1] ?? null;
  };
  reader.onerror = () => {
    submitError.value = "Não foi possível ler o anexo.";
  };
  reader.readAsDataURL(file);
  attachmentFile.value = file;
}

function removeAttachment(): void {
  attachmentFile.value = null;
  attachmentBase64.value = null;
  if (fileInputRef.value) fileInputRef.value.value = "";
}

function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function downloadEngagementAttachment(engagement: AutomationEngagement): Promise<void> {
  try {
    const attachment = await client.getAttachment(engagement.id);
    const blob = base64ToBlob(attachment.base64, attachment.mimeType);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.log("[automation-work] falha ao baixar anexo", error);
  }
}

const STAGE_DOWNLOAD_EXT: Record<AutomationStageId, { ext: string; mime: string }> = {
  DIAGNOSTICO: { ext: "json", mime: "application/json" },
  MAPA_PROCESSOS: { ext: "md", mime: "text/markdown" },
  AUTOMACOES_RECOMENDADAS: { ext: "json", mime: "application/json" },
  ARQUITETURA_INTEGRACAO: { ext: "json", mime: "application/json" },
  PLANO_IMPLEMENTACAO: { ext: "json", mime: "application/json" },
  PLAYBOOK_OPERACIONAL: { ext: "json", mime: "application/json" },
  FRAMEWORK_MONITORAMENTO: { ext: "json", mime: "application/json" },
};

function downloadStage(engagement: AutomationEngagement, stage: AutomationStageId): void {
  const content = engagement[STAGE_FIELD[stage]] as string | null;
  if (!content) return;
  const { ext, mime } = STAGE_DOWNLOAD_EXT[stage];
  const slug = engagement.niche.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const stageSlug = AUTOMATION_STAGE_LABEL[stage].toLowerCase().replace(/[^a-z0-9]+/g, "-");
  triggerDownload(`${slug}-${stageSlug}.${ext}`, content, mime);
}

let pollHandle: ReturnType<typeof setInterval> | null = null;

function stopPolling(): void {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

async function refreshActive(): Promise<void> {
  if (!activeId.value) return;
  try {
    const updated = await client.getEngagement(activeId.value);
    engagements.value = engagements.value.map((e) => (e.id === updated.id ? updated : e));
    if (updated.status === "DONE" || updated.status === "ERROR") {
      stopPolling();
    }
  } catch (error) {
    console.log("[automation-work] falha ao atualizar engajamento", error);
  }
}

function startPolling(): void {
  stopPolling();
  pollHandle = setInterval(refreshActive, 2500);
}

async function loadEngagements(): Promise<void> {
  listState.value = "loading";
  listError.value = null;
  try {
    engagements.value = await client.listEngagements();
    if (!activeId.value && engagements.value.length > 0) {
      activeId.value = engagements.value[0]!.id;
    }
    listState.value = "ready";
    if (active.value && (active.value.status === "PENDING" || active.value.status === "RUNNING")) {
      startPolling();
    }
  } catch (error) {
    listError.value =
      error instanceof Error ? error.message : "Não foi possível consultar os engajamentos.";
    listState.value = "error";
    console.log("[automation-work] falha ao carregar engajamentos", error);
  }
}

async function loadNiches(): Promise<void> {
  try {
    niches.value = await crm.listNiches();
  } catch (error) {
    console.log("[automation-work] falha ao carregar nichos", error);
  }
}

async function loadClients(): Promise<void> {
  try {
    clients.value = await crm.listClients();
  } catch (error) {
    console.log("[automation-work] falha ao carregar clientes", error);
  }
}

async function submitBriefing(): Promise<void> {
  if (niche.value.trim().length < 2 || briefing.value.trim().length < 10) {
    submitError.value = "Preencha o nicho e um briefing com pelo menos 10 caracteres.";
    return;
  }
  submitting.value = true;
  submitError.value = null;
  try {
    const created = await client.createEngagement({
      niche: niche.value.trim(),
      briefing: briefing.value.trim(),
      ...(clientName.value.trim() ? { clientName: clientName.value.trim() } : {}),
      ...(attachmentFile.value && attachmentBase64.value
        ? {
            attachmentName: attachmentFile.value.name,
            attachmentMimeType: attachmentFile.value.type || "application/octet-stream",
            attachmentBase64: attachmentBase64.value,
          }
        : {}),
    });
    engagements.value = [created, ...engagements.value];
    activeId.value = created.id;
    niche.value = "";
    briefing.value = "";
    clientName.value = "";
    removeAttachment();
    startPolling();
    void loadNiches();
    void loadClients();
  } catch (error) {
    submitError.value =
      error instanceof Error ? error.message : "Não foi possível criar o engajamento.";
    console.log("[automation-work] falha ao criar engajamento", error);
  } finally {
    submitting.value = false;
  }
}

function selectEngagement(id: string): void {
  activeId.value = id;
  const engagement = engagements.value.find((e) => e.id === id);
  if (engagement && (engagement.status === "PENDING" || engagement.status === "RUNNING")) {
    startPolling();
  } else {
    stopPolling();
  }
}

const STAGE_FIELD = {
  DIAGNOSTICO: "diagnostico",
  MAPA_PROCESSOS: "mapaProcessos",
  AUTOMACOES_RECOMENDADAS: "automacoesRecomendadas",
  ARQUITETURA_INTEGRACAO: "arquiteturaIntegracao",
  PLANO_IMPLEMENTACAO: "planoImplementacao",
  PLAYBOOK_OPERACIONAL: "playbookOperacional",
  FRAMEWORK_MONITORAMENTO: "frameworkMonitoramento",
} as const satisfies Record<AutomationStageId, keyof AutomationEngagement>;

function stageStatus(
  engagement: AutomationEngagement,
  stage: AutomationStageId,
): "pending" | "running" | "done" {
  const field = STAGE_FIELD[stage];
  if (engagement[field]) return "done";
  if (engagement.currentStage === stage) return "running";
  return "pending";
}

function isStageFallback(engagement: AutomationEngagement, stage: AutomationStageId): boolean {
  return engagement.fallbackStages.includes(stage);
}

const openStage = ref<AutomationStageId | null>(null);

function toggleStage(stage: AutomationStageId): void {
  openStage.value = openStage.value === stage ? null : stage;
}

interface Diagnostico {
  baseadoEmDadosReais: boolean;
  resumoExecutivo: string;
  hipoteses: readonly { processo: string; hipotese: string; sinalComum: string; oQueFazer: string }[];
  avisoTransparencia: string;
}

interface AutomacoesRecomendadas {
  automacoes: readonly {
    processo: string;
    automacaoProposta: string;
    ferramentaSugerida: string;
    impactoEsperado: string;
    complexidade: string;
  }[];
}

interface ArquiteturaIntegracao {
  sistemas: readonly { nome: string; papel: string; tipoIntegracao: string }[];
  fluxoDeDados: string;
  riscosTecnicos: readonly string[];
}

interface PlanoImplementacao {
  fases: readonly { semana: number; foco: string; entregaveis: readonly string[] }[];
  dependencias: readonly string[];
}

interface PlaybookOperacional {
  comoUsar: string;
  errosComuns: readonly { erro: string; comoResolver: string }[];
  quandoEscalarParaHumano: readonly string[];
  notaDeAdocao: string;
}

interface FrameworkMonitoramento {
  metricas: readonly {
    nome: string;
    oQueMede: string;
    frequencia: string;
    referenciaDeMercado: string;
    seAbaixoDoEsperado: string;
  }[];
  notaImportante: string;
}

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const activeDiagnostico = computed<Diagnostico | null>(() => parseJson<Diagnostico>(active.value?.diagnostico));
const activeAutomacoes = computed<AutomacoesRecomendadas | null>(() =>
  parseJson<AutomacoesRecomendadas>(active.value?.automacoesRecomendadas),
);
const activeArquitetura = computed<ArquiteturaIntegracao | null>(() =>
  parseJson<ArquiteturaIntegracao>(active.value?.arquiteturaIntegracao),
);
const activePlano = computed<PlanoImplementacao | null>(() =>
  parseJson<PlanoImplementacao>(active.value?.planoImplementacao),
);
const activePlaybook = computed<PlaybookOperacional | null>(() =>
  parseJson<PlaybookOperacional>(active.value?.playbookOperacional),
);
const activeMonitoramento = computed<FrameworkMonitoramento | null>(() =>
  parseJson<FrameworkMonitoramento>(active.value?.frameworkMonitoramento),
);

/** Markdown minimo e seguro (sem libs) — mesmo renderer do Mercurio. */
function renderMarkdown(source: string): string {
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withInline = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  const lines = withInline.split("\n");
  const html: string[] = [];
  let inList = false;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);

    if (li) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${li[1]}</li>`);
      continue;
    }
    if (inList) {
      html.push("</ul>");
      inList = false;
    }

    if (h2) {
      html.push(`<h4>${h2[1]}</h4>`);
    } else if (h1) {
      html.push(`<h3>${h1[1]}</h3>`);
    } else if (line.trim().length > 0) {
      html.push(`<p>${line}</p>`);
    }
  }
  if (inList) html.push("</ul>");
  return html.join("\n");
}

function statusLabel(status: AutomationEngagement["status"]): string {
  switch (status) {
    case "PENDING":
      return "na fila";
    case "RUNNING":
      return "trabalhando";
    case "DONE":
      return "concluído";
    case "ERROR":
      return "falhou";
  }
}

/** Engajamentos do MESMO nicho do ativo, mais antigo primeiro — Cerebro do Nicho. */
const sameNicheEngagements = computed(() => {
  if (!active.value) return [];
  return engagements.value
    .filter((e) => e.nicheId === active.value!.nicheId)
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
});

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}min ${seconds}s` : `${seconds}s`;
}

function formatReuseRatio(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${Math.round(ratio * 100)}%`;
}

onMounted(() => {
  void loadEngagements();
  void loadNiches();
  void loadClients();
});

onBeforeUnmount(() => {
  stopPolling();
});
</script>

<template>
  <OperationalHeader
    :floor="floor"
    :scope-line="`${floor.name} · dados isolados`"
    title="Clientes"
    lede="Atlas recebe o briefing e entrega o diagnóstico e o plano de automação completo do cliente."
    :show-cta="false"
    :show-refresh="true"
    @refresh="loadEngagements"
  />

  <div class="op-content">
    <section class="op-panel op-brief">
      <h3 class="op-panel__title">Briefing para o Atlas</h3>
      <div class="op-brief__row">
        <input
          v-model="niche"
          type="text"
          class="op-input"
          list="op-niche-options"
          placeholder="Nicho (ex: clínica veterinária, foco em atendimento)"
          :disabled="submitting"
        />
        <datalist id="op-niche-options">
          <option v-for="n in niches" :key="n.id" :value="n.name" />
        </datalist>
        <input
          v-model="clientName"
          type="text"
          class="op-input"
          list="op-client-options"
          placeholder="Cliente (opcional — nome do negócio atendido)"
          :disabled="submitting"
        />
        <datalist id="op-client-options">
          <option v-for="c in clients" :key="c.id" :value="c.name" />
        </datalist>
      </div>
      <textarea
        v-model="briefing"
        class="op-textarea"
        rows="3"
        placeholder="Descreva o briefing: quais processos hoje são manuais, quais ferramentas já usa..."
        :disabled="submitting"
      ></textarea>

      <div class="op-attach-row">
        <input
          ref="fileInputRef"
          type="file"
          class="op-attach-input"
          accept="image/*,text/plain,.md,.pdf"
          :disabled="submitting"
          @change="onAttachmentChange"
        />
        <span v-if="attachmentFile" class="op-attach-chip">
          📎 {{ attachmentFile.name }}
          <button type="button" class="op-attach-remove" title="Remover anexo" @click="removeAttachment">✕</button>
        </span>
      </div>
      <p class="op-attach-hint">
        Opcional: anexe uma imagem (print de fluxo, planilha) ou um arquivo de texto — até 4MB.
        Imagem entra de verdade na análise do Atlas; PDF fica só guardado, ainda sem leitura automática.
      </p>

      <p v-if="submitError" class="op-error-inline">{{ submitError }}</p>
      <button type="button" class="op-btn op-btn--cta" :disabled="submitting" @click="submitBriefing">
        {{ submitting ? "Enviando…" : "Gerar diagnóstico" }}
      </button>
    </section>

    <p v-if="listState === 'loading' && engagements.length === 0" class="op-loading">
      Consultando engajamentos…
    </p>
    <p v-else-if="listState === 'error'" class="op-empty-inline">{{ listError }}</p>
    <p v-else-if="listState === 'ready' && engagements.length === 0" class="op-empty-inline">
      Nenhum engajamento ainda. Descreva um nicho acima para o Atlas começar.
    </p>

    <div v-else class="op-layout">
      <aside class="op-panel op-list">
        <h3 class="op-panel__title">Clientes</h3>
        <button
          v-for="e in engagements"
          :key="e.id"
          type="button"
          class="op-list__item"
          :class="{ 'is-active': e.id === activeId }"
          @click="selectEngagement(e.id)"
        >
          <span class="op-list__niche">
            <template v-if="e.clientName">{{ e.clientName }} · {{ e.niche }}</template>
            <template v-else>{{ e.niche }}</template>
            <span v-if="e.fallbackStages.length > 0" title="Alguma etapa saiu com conteúdo genérico">⚠️</span>
          </span>
          <span
            class="op-work-card__status"
            :class="{
              'is-green': e.status === 'DONE',
              'is-amber': e.status === 'RUNNING' || e.status === 'PENDING',
              'is-red': e.status === 'ERROR',
            }"
          >
            {{ statusLabel(e.status) }}
          </span>
        </button>
      </aside>

      <section v-if="active" class="op-panel op-pipeline">
        <div class="op-pipeline__head">
          <div>
            <h3 class="op-panel__title">
              <template v-if="active.clientName">{{ active.clientName }} · {{ active.niche }}</template>
              <template v-else>{{ active.niche }}</template>
            </h3>
            <p class="op-mono op-muted-line">{{ active.briefing }}</p>
            <button
              v-if="active.attachmentName"
              type="button"
              class="op-attach-link"
              @click="downloadEngagementAttachment(active)"
            >
              📎 {{ active.attachmentName }} · baixar
            </button>
          </div>
          <span
            class="op-work-card__status"
            :class="{
              'is-green': active.status === 'DONE',
              'is-amber': active.status === 'RUNNING' || active.status === 'PENDING',
              'is-red': active.status === 'ERROR',
            }"
          >
            Atlas · {{ statusLabel(active.status) }}
          </span>
        </div>

        <p v-if="active.status === 'ERROR'" class="op-error-inline">
          {{ active.errorMessage ?? "Falha desconhecida." }}
        </p>

        <div v-if="activeDiagnostico" class="op-diagnostico">
          <h4 class="op-diagnostico__title">💡 Onde este negócio provavelmente perde tempo e dinheiro</h4>
          <p class="op-diagnostico__resumo">{{ activeDiagnostico.resumoExecutivo }}</p>
          <div class="op-diagnostico__list">
            <div v-for="(h, i) in activeDiagnostico.hipoteses" :key="i" class="op-diagnostico__item">
              <span class="op-diagnostico__area">{{ h.processo }}</span>
              <p class="op-diagnostico__hipotese">{{ h.hipotese }}</p>
              <p class="op-diagnostico__detail"><strong>Sinal comum:</strong> {{ h.sinalComum }}</p>
              <p class="op-diagnostico__detail"><strong>O que fazer:</strong> {{ h.oQueFazer }}</p>
            </div>
          </div>
          <p class="op-diagnostico__aviso">
            {{ activeDiagnostico.baseadoEmDadosReais ? "📊" : "🌱" }} {{ activeDiagnostico.avisoTransparencia }}
          </p>
        </div>

        <div v-if="sameNicheEngagements.length > 1" class="op-reuse-panel">
          <h4 class="op-reuse-panel__title">Cérebro do Nicho — {{ active.niche }}</h4>
          <p class="op-reuse-panel__hint">
            Tempo de geração e reaproveitamento de conhecimento entre os clientes deste setor, na ordem em que foram criados.
          </p>
          <table class="op-reuse-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Tempo de geração</th>
                <th>Reaproveitado</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(e, index) in sameNicheEngagements"
                :key="e.id"
                :class="{ 'is-current': e.id === active.id }"
              >
                <td>{{ index + 1 }}</td>
                <td>{{ e.clientName ?? "sem cliente" }}</td>
                <td class="op-mono">{{ formatDuration(e.totalDurationMs) }}</td>
                <td class="op-mono">{{ formatReuseRatio(e.reuseRatio) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ol class="op-stages">
          <li v-for="stage in AUTOMATION_STAGE_ORDER" :key="stage" class="op-stage">
            <button
              type="button"
              class="op-stage__row"
              :disabled="stageStatus(active, stage) !== 'done'"
              @click="toggleStage(stage)"
            >
              <span
                class="op-stage__icon"
                :class="isStageFallback(active, stage) ? 'is-fallback' : `is-${stageStatus(active, stage)}`"
              >
                <template v-if="stageStatus(active, stage) === 'done' && isStageFallback(active, stage)">⚠</template>
                <template v-else-if="stageStatus(active, stage) === 'done'">✓</template>
                <template v-else-if="stageStatus(active, stage) === 'running'">⋯</template>
                <template v-else>•</template>
              </span>
              <span class="op-stage__label">{{ AUTOMATION_STAGE_LABEL[stage] }}</span>
              <span v-if="isStageFallback(active, stage)" class="op-stage__fallback-tag">
                conteúdo genérico
              </span>
              <span
                v-if="stageStatus(active, stage) === 'done'"
                class="op-stage__download"
                title="Baixar esta etapa"
                @click.stop="downloadStage(active, stage)"
              >
                ⬇
              </span>
              <span v-if="stageStatus(active, stage) === 'done'" class="op-stage__toggle">
                {{ openStage === stage ? "ocultar" : "ver" }}
              </span>
            </button>

            <div v-if="openStage === stage && stageStatus(active, stage) === 'done'" class="op-stage__body">
              <p v-if="isStageFallback(active, stage)" class="op-stage__fallback-warning">
                ⚠️ Esta etapa não foi gerada pela IA — o conteúdo abaixo é um texto genérico de segurança, usado
                quando o modelo fica indisponível. Rode o engajamento novamente para tentar gerar o conteúdo real.
              </p>

              <div v-if="stage === 'DIAGNOSTICO' && activeDiagnostico" class="op-structured">
                <div class="op-structured__section">
                  <h4>Resumo executivo</h4>
                  <p>{{ activeDiagnostico.resumoExecutivo }}</p>
                </div>
                <div class="op-structured__section">
                  <h4>Hipóteses de perda de tempo e dinheiro</h4>
                  <ul>
                    <li v-for="(h, i) in activeDiagnostico.hipoteses" :key="i">
                      <strong>{{ h.processo }}:</strong> {{ h.hipotese }} — {{ h.sinalComum }} → {{ h.oQueFazer }}
                    </li>
                  </ul>
                </div>
                <div class="op-structured__section">
                  <p><em>{{ activeDiagnostico.avisoTransparencia }}</em></p>
                </div>
              </div>

              <div
                v-else-if="stage === 'AUTOMACOES_RECOMENDADAS' && activeAutomacoes"
                class="op-structured"
              >
                <div class="op-structured__section">
                  <h4>Automações recomendadas</h4>
                  <ul>
                    <li v-for="(a, i) in activeAutomacoes.automacoes" :key="i">
                      <strong>{{ a.processo }}:</strong> {{ a.automacaoProposta }} — {{ a.ferramentaSugerida }}
                      · impacto: {{ a.impactoEsperado }} · complexidade: {{ a.complexidade }}
                    </li>
                  </ul>
                </div>
              </div>

              <div
                v-else-if="stage === 'ARQUITETURA_INTEGRACAO' && activeArquitetura"
                class="op-structured"
              >
                <div class="op-structured__section">
                  <h4>Sistemas envolvidos</h4>
                  <ul>
                    <li v-for="s in activeArquitetura.sistemas" :key="s.nome">
                      <strong>{{ s.nome }}</strong> ({{ s.papel }}) — {{ s.tipoIntegracao }}
                    </li>
                  </ul>
                </div>
                <div class="op-structured__section">
                  <h4>Fluxo de dados</h4>
                  <p>{{ activeArquitetura.fluxoDeDados }}</p>
                </div>
                <div class="op-structured__section">
                  <h4>Riscos técnicos</h4>
                  <ul>
                    <li v-for="(r, i) in activeArquitetura.riscosTecnicos" :key="i">{{ r }}</li>
                  </ul>
                </div>
              </div>

              <div v-else-if="stage === 'PLANO_IMPLEMENTACAO' && activePlano" class="op-structured">
                <div class="op-structured__section">
                  <h4>Fases</h4>
                  <div class="op-kanban">
                    <div v-for="f in activePlano.fases" :key="f.semana" class="op-kanban__col">
                      <span class="op-kanban__head">Semana {{ f.semana }}</span>
                      <span class="op-kanban__focus">{{ f.foco }}</span>
                      <ul>
                        <li v-for="(item, i) in f.entregaveis" :key="i">{{ item }}</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div class="op-structured__section">
                  <h4>Dependências</h4>
                  <ul>
                    <li v-for="(d, i) in activePlano.dependencias" :key="i">{{ d }}</li>
                  </ul>
                </div>
              </div>

              <div
                v-else-if="stage === 'PLAYBOOK_OPERACIONAL' && activePlaybook"
                class="op-structured"
              >
                <div class="op-structured__section">
                  <h4>Como usar</h4>
                  <p>{{ activePlaybook.comoUsar }}</p>
                </div>
                <div class="op-structured__section">
                  <h4>Erros comuns</h4>
                  <div v-for="(e, i) in activePlaybook.errosComuns" :key="i" class="op-objection">
                    <p class="op-objection__q">{{ e.erro }}</p>
                    <p class="op-objection__a">{{ e.comoResolver }}</p>
                  </div>
                </div>
                <div class="op-structured__section">
                  <h4>Quando escalar para humano</h4>
                  <ul>
                    <li v-for="(q, i) in activePlaybook.quandoEscalarParaHumano" :key="i">{{ q }}</li>
                  </ul>
                </div>
                <div class="op-structured__section">
                  <p><em>{{ activePlaybook.notaDeAdocao }}</em></p>
                </div>
              </div>

              <div
                v-else-if="stage === 'FRAMEWORK_MONITORAMENTO' && activeMonitoramento"
                class="op-structured"
              >
                <div class="op-structured__section">
                  <p class="op-perf__note">{{ activeMonitoramento.notaImportante }}</p>
                </div>
                <div class="op-structured__section">
                  <div class="op-perf-grid">
                    <div v-for="m in activeMonitoramento.metricas" :key="m.nome" class="op-perf-card">
                      <div class="op-perf-card__head">{{ m.nome }}</div>
                      <div class="op-perf-card__freq">{{ m.oQueMede }} · {{ m.frequencia }}</div>
                      <div class="op-perf-card__ref">{{ m.referenciaDeMercado }}</div>
                      <div class="op-perf-card__action">{{ m.seAbaixoDoEsperado }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-else
                class="op-md"
                v-html="renderMarkdown((active[STAGE_FIELD[stage]] as string) ?? '')"
              />
            </div>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.op-panel {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  padding: 20px;
}

.op-panel__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin-bottom: 12px;
}

.op-brief__row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.op-input,
.op-textarea {
  width: 100%;
  background: var(--op-raise);
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  padding: 10px 12px;
  font-size: 13px;
  color: var(--op-ink-2);
  font-family: inherit;
  resize: vertical;
}

.op-input:focus,
.op-textarea:focus {
  outline: none;
  border-color: var(--op-cta);
}

.op-textarea {
  margin-bottom: 12px;
}

.op-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-raise);
  color: var(--op-ink-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.op-btn:hover:not(:disabled) {
  border-color: var(--op-bd-btn-h);
}

.op-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.op-btn--cta {
  background: var(--op-cta);
  border-color: var(--op-cta);
  color: #fff;
}

.op-btn--cta:hover:not(:disabled) {
  background: var(--op-cta-h);
}

.op-error-inline {
  color: var(--op-red);
  font-size: 12px;
  margin-bottom: 10px;
}

.op-empty-inline,
.op-loading {
  font-size: 13px;
  color: var(--op-muted-3);
}

.op-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 20px;
  align-items: start;
}

.op-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
}

.op-list__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: var(--op-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.op-list__item:hover {
  background: var(--op-hover);
}

.op-list__item.is-active {
  background: var(--op-sel);
  border-color: var(--op-bd-sel);
}

.op-list__niche {
  font-size: 13px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-work-card__status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--op-radius-full);
  background: var(--op-raise);
  color: var(--op-muted-2);
  width: fit-content;
}

.op-work-card__status.is-green {
  color: var(--op-green);
  background: var(--op-halo);
}

.op-work-card__status.is-amber {
  color: var(--op-amber);
}

.op-work-card__status.is-red {
  color: var(--op-red);
}

.op-pipeline__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.op-muted-line {
  color: var(--op-muted-3);
  font-size: 12px;
  margin-top: 4px;
}

.op-reuse-panel {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  padding: 14px 16px;
  margin-bottom: 16px;
}

.op-reuse-panel__title {
  font-size: 13px;
  font-weight: 700;
  margin: 0 0 4px;
}

.op-reuse-panel__hint {
  font-size: 12px;
  color: var(--op-muted-3);
  margin: 0 0 12px;
}

.op-reuse-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.op-reuse-table th {
  text-align: left;
  font-weight: 600;
  color: var(--op-muted-3);
  padding: 4px 8px;
  border-bottom: 1px solid var(--op-line);
}

.op-reuse-table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--op-line);
}

.op-reuse-table tr:last-child td {
  border-bottom: none;
}

.op-reuse-table tr.is-current td {
  color: var(--op-cta);
  font-weight: 600;
}

.op-diagnostico {
  border: 1px solid var(--op-cta);
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  padding: 16px 18px;
  margin-bottom: 16px;
}

.op-diagnostico__title {
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 8px;
}

.op-diagnostico__resumo {
  font-size: 13.5px;
  color: var(--op-ink-2);
  margin: 0 0 14px;
  line-height: 1.5;
}

.op-diagnostico__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.op-diagnostico__item {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  background: var(--op-panel-2);
  padding: 10px 12px;
}

.op-diagnostico__area {
  display: inline-block;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--op-cta);
  margin-bottom: 4px;
}

.op-diagnostico__hipotese {
  font-size: 13.5px;
  font-weight: 600;
  margin: 0 0 4px;
}

.op-diagnostico__detail {
  font-size: 12px;
  color: var(--op-muted-3);
  margin: 0;
  line-height: 1.5;
}

.op-diagnostico__aviso {
  font-size: 11.5px;
  color: var(--op-muted-3);
  margin: 0;
  font-style: italic;
}

.op-stages {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.op-stage__row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-line);
  background: var(--op-raise);
  cursor: pointer;
  text-align: left;
}

.op-stage__row:disabled {
  cursor: default;
  opacity: 0.7;
}

.op-stage__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  background: var(--op-track);
  color: var(--op-muted-3);
}

.op-stage__icon.is-done {
  background: var(--op-halo);
  color: var(--op-green);
}

.op-stage__icon.is-running {
  color: var(--op-amber);
}

.op-stage__icon.is-fallback {
  background: color-mix(in srgb, var(--op-red) 16%, transparent);
  color: var(--op-red);
}

.op-stage__label {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-stage__fallback-tag {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--op-red);
  border: 1px solid color-mix(in srgb, var(--op-red) 40%, transparent);
  border-radius: var(--op-radius-sm);
  padding: 2px 6px;
}

.op-stage__fallback-warning {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: var(--op-radius-sm);
  background: color-mix(in srgb, var(--op-red) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--op-red) 30%, transparent);
  color: var(--op-red);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.op-stage__toggle {
  font-size: 11px;
  color: var(--op-cta);
  font-weight: 600;
}

.op-stage__download {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--op-radius-sm);
  color: var(--op-muted-3);
  font-size: 12px;
}

.op-stage__download:hover {
  background: var(--op-hover);
  color: var(--op-ink-2);
}

.op-attach-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.op-attach-input {
  font-size: 12px;
  color: var(--op-muted-2);
  max-width: 100%;
}

.op-attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: var(--op-radius-full);
  background: var(--op-sel);
  color: var(--op-ink-2);
}

.op-attach-remove {
  border: none;
  background: none;
  color: var(--op-muted-3);
  cursor: pointer;
  font-size: 11px;
  padding: 0;
}

.op-attach-remove:hover {
  color: var(--op-red);
}

.op-attach-hint {
  font-size: 11px;
  color: var(--op-muted-4);
  margin-bottom: 12px;
}

.op-attach-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  border: none;
  background: none;
  padding: 0;
  font-size: 11.5px;
  color: var(--op-cta);
  cursor: pointer;
  text-decoration: underline;
}

.op-perf__note {
  font-size: 12.5px;
  color: var(--op-amber);
  background: color-mix(in srgb, var(--op-amber) 12%, transparent);
  border-radius: var(--op-radius-sm);
  padding: 10px 12px;
}

.op-perf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.op-perf-card {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  padding: 12px;
}

.op-perf-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--op-ink-2);
}

.op-perf-card__freq {
  font-size: 11.5px;
  color: var(--op-muted-3);
  margin-bottom: 4px;
}

.op-perf-card__ref {
  font-size: 12px;
  color: var(--op-ink-4);
  margin-bottom: 6px;
}

.op-perf-card__action {
  font-size: 11.5px;
  color: var(--op-muted-2);
}

.op-stage__body {
  padding: 14px 16px;
  border: 1px solid var(--op-line);
  border-top: none;
  border-radius: 0 0 var(--op-radius-sm) var(--op-radius-sm);
  background: var(--op-panel-2);
}

.op-md {
  font-size: 13px;
  line-height: 1.6;
  color: var(--op-ink-4);
}

.op-md :deep(h3) {
  font-size: 14px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin: 14px 0 6px;
}

.op-md :deep(h4) {
  font-size: 13px;
  font-weight: 700;
  color: var(--op-ink-3);
  margin: 12px 0 4px;
}

.op-md :deep(p) {
  margin: 4px 0;
}

.op-md :deep(ul) {
  margin: 4px 0 4px 18px;
}

.op-structured {
  display: flex;
  flex-direction: column;
  gap: 18px;
  font-size: 13px;
  color: var(--op-ink-4);
}

.op-structured__section h4 {
  font-size: 13px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin-bottom: 8px;
}

.op-structured__section ul {
  margin: 0 0 0 18px;
  line-height: 1.6;
}

.op-structured__section p {
  line-height: 1.6;
}

.op-kanban {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 1fr));
  gap: 10px;
  overflow-x: auto;
}

.op-kanban__col {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.op-kanban__head {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--op-cta);
}

.op-kanban__focus {
  font-size: 12px;
  font-weight: 600;
  color: var(--op-ink-3);
}

.op-kanban__col ul {
  margin: 4px 0 0 16px;
  font-size: 12px;
  color: var(--op-muted-2);
}

.op-objection {
  border-left: 2px solid var(--op-bd-chip);
  padding: 4px 0 4px 12px;
  margin-bottom: 10px;
}

.op-objection__q {
  font-style: italic;
  color: var(--op-muted-2);
  margin-bottom: 2px;
}

.op-objection__a {
  color: var(--op-ink-3);
}

@media (max-width: 720px) {
  .op-kanban {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .op-layout {
    grid-template-columns: 1fr;
  }
}
</style>
