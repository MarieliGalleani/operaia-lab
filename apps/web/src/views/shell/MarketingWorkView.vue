<script setup lang="ts">
/**
 * Trabalhos do andar Marketing — Mercurio real (Marketing Lead) rodando
 * um pipeline de 6 etapas por campanha/nicho: Mapa de Nicho, Criativos,
 * Landing Page, Pitch Deck, Plano de GTM, Playbook de Vendas. Cada
 * etapa e uma chamada real de LLM (ver apps/api marketing-office),
 * sem conteudo estatico/fake.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import {
  MARKETING_STAGE_LABEL,
  MARKETING_STAGE_ORDER,
  createMarketingOfficeClient,
  type MarketingCampaign,
  type MarketingStageId,
} from "@/data/adapters/marketing-office-client";

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
const client = createMarketingOfficeClient();

const listState = ref<"idle" | "loading" | "ready" | "error">("idle");
const listError = ref<string | null>(null);
const campaigns = ref<readonly MarketingCampaign[]>([]);
const activeId = ref<string | null>(null);
const active = computed(() => campaigns.value.find((c) => c.id === activeId.value) ?? null);

const niche = ref("");
const briefing = ref("");
const submitting = ref(false);
const submitError = ref<string | null>(null);

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
    const updated = await client.getCampaign(activeId.value);
    campaigns.value = campaigns.value.map((c) => (c.id === updated.id ? updated : c));
    if (updated.status === "DONE" || updated.status === "ERROR") {
      stopPolling();
    }
  } catch (error) {
    console.log("[marketing-work] falha ao atualizar campanha", error);
  }
}

function startPolling(): void {
  stopPolling();
  pollHandle = setInterval(refreshActive, 2500);
}

async function loadCampaigns(): Promise<void> {
  listState.value = "loading";
  listError.value = null;
  try {
    campaigns.value = await client.listCampaigns();
    if (!activeId.value && campaigns.value.length > 0) {
      activeId.value = campaigns.value[0]!.id;
    }
    listState.value = "ready";
    if (active.value && (active.value.status === "PENDING" || active.value.status === "RUNNING")) {
      startPolling();
    }
  } catch (error) {
    listError.value =
      error instanceof Error ? error.message : "Não foi possível consultar as campanhas.";
    listState.value = "error";
    console.log("[marketing-work] falha ao carregar campanhas", error);
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
    const created = await client.createCampaign({
      niche: niche.value.trim(),
      briefing: briefing.value.trim(),
    });
    campaigns.value = [created, ...campaigns.value];
    activeId.value = created.id;
    niche.value = "";
    briefing.value = "";
    startPolling();
  } catch (error) {
    submitError.value =
      error instanceof Error ? error.message : "Não foi possível criar a campanha.";
    console.log("[marketing-work] falha ao criar campanha", error);
  } finally {
    submitting.value = false;
  }
}

function selectCampaign(id: string): void {
  activeId.value = id;
  const campaign = campaigns.value.find((c) => c.id === id);
  if (campaign && (campaign.status === "PENDING" || campaign.status === "RUNNING")) {
    startPolling();
  } else {
    stopPolling();
  }
}

function stageStatus(
  campaign: MarketingCampaign,
  stage: MarketingStageId,
): "pending" | "running" | "done" {
  const field = STAGE_FIELD[stage];
  if (campaign[field]) return "done";
  if (campaign.currentStage === stage) return "running";
  return "pending";
}

const STAGE_FIELD = {
  MAPA_NICHO: "nicheMap",
  CRIATIVOS: "creatives",
  LANDING_PAGE: "landingPageHtml",
  PITCH_DECK: "pitchDeck",
  PLANO_GTM: "gtmPlan",
  PLAYBOOK_VENDAS: "salesPlaybook",
} as const satisfies Record<MarketingStageId, keyof MarketingCampaign>;

const openStage = ref<MarketingStageId | null>(null);

function toggleStage(stage: MarketingStageId): void {
  openStage.value = openStage.value === stage ? null : stage;
}

/** Markdown minimo e seguro (sem libs): escapa tudo, depois aplica so os
 * padroes que o proprio Mercurio usa nos prompts (#, ##, -, **negrito**). */
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

function statusLabel(status: MarketingCampaign["status"]): string {
  switch (status) {
    case "PENDING":
      return "na fila";
    case "RUNNING":
      return "trabalhando";
    case "DONE":
      return "concluída";
    case "ERROR":
      return "falhou";
  }
}

onMounted(() => {
  void loadCampaigns();
});

onBeforeUnmount(() => {
  stopPolling();
});
</script>

<template>
  <OperationalHeader
    :floor="floor"
    :scope-line="`${floor.name} · dados isolados`"
    title="Trabalhos"
    lede="Mercúrio recebe o briefing e entrega o pipeline completo da campanha."
    :show-cta="false"
    :show-refresh="true"
    @refresh="loadCampaigns"
  />

  <div class="op-content">
    <section class="op-panel op-brief">
      <h3 class="op-panel__title">Briefing para o Mercúrio</h3>
      <div class="op-brief__row">
        <input
          v-model="niche"
          type="text"
          class="op-input"
          placeholder="Nicho (ex: dermatologia, foco em agenda cheia)"
          :disabled="submitting"
        />
      </div>
      <textarea
        v-model="briefing"
        class="op-textarea"
        rows="3"
        placeholder="Descreva o briefing: publico, objetivo, oferta, o que já sabe sobre o cliente..."
        :disabled="submitting"
      ></textarea>
      <p v-if="submitError" class="op-error-inline">{{ submitError }}</p>
      <button type="button" class="op-btn op-btn--cta" :disabled="submitting" @click="submitBriefing">
        {{ submitting ? "Enviando…" : "Gerar campanha" }}
      </button>
    </section>

    <p v-if="listState === 'loading' && campaigns.length === 0" class="op-loading">
      Consultando campanhas…
    </p>
    <p v-else-if="listState === 'error'" class="op-empty-inline">{{ listError }}</p>
    <p v-else-if="listState === 'ready' && campaigns.length === 0" class="op-empty-inline">
      Nenhuma campanha ainda. Descreva um nicho acima para o Mercúrio começar.
    </p>

    <div v-else class="op-layout">
      <aside class="op-panel op-list">
        <h3 class="op-panel__title">Campanhas</h3>
        <button
          v-for="c in campaigns"
          :key="c.id"
          type="button"
          class="op-list__item"
          :class="{ 'is-active': c.id === activeId }"
          @click="selectCampaign(c.id)"
        >
          <span class="op-list__niche">{{ c.niche }}</span>
          <span
            class="op-work-card__status"
            :class="{
              'is-green': c.status === 'DONE',
              'is-amber': c.status === 'RUNNING' || c.status === 'PENDING',
              'is-red': c.status === 'ERROR',
            }"
          >
            {{ statusLabel(c.status) }}
          </span>
        </button>
      </aside>

      <section v-if="active" class="op-panel op-pipeline">
        <div class="op-pipeline__head">
          <div>
            <h3 class="op-panel__title">{{ active.niche }}</h3>
            <p class="op-mono op-muted-line">{{ active.briefing }}</p>
          </div>
          <span
            class="op-work-card__status"
            :class="{
              'is-green': active.status === 'DONE',
              'is-amber': active.status === 'RUNNING' || active.status === 'PENDING',
              'is-red': active.status === 'ERROR',
            }"
          >
            Mercúrio · {{ statusLabel(active.status) }}
          </span>
        </div>

        <p v-if="active.status === 'ERROR'" class="op-error-inline">
          {{ active.errorMessage ?? "Falha desconhecida." }}
        </p>

        <ol class="op-stages">
          <li v-for="stage in MARKETING_STAGE_ORDER" :key="stage" class="op-stage">
            <button
              type="button"
              class="op-stage__row"
              :disabled="stageStatus(active, stage) !== 'done'"
              @click="toggleStage(stage)"
            >
              <span class="op-stage__icon" :class="`is-${stageStatus(active, stage)}`">
                <template v-if="stageStatus(active, stage) === 'done'">✓</template>
                <template v-else-if="stageStatus(active, stage) === 'running'">⋯</template>
                <template v-else>•</template>
              </span>
              <span class="op-stage__label">{{ MARKETING_STAGE_LABEL[stage] }}</span>
              <span v-if="stageStatus(active, stage) === 'done'" class="op-stage__toggle">
                {{ openStage === stage ? "ocultar" : "ver" }}
              </span>
            </button>

            <div v-if="openStage === stage && stageStatus(active, stage) === 'done'" class="op-stage__body">
              <iframe
                v-if="stage === 'LANDING_PAGE' && active.landingPageHtml"
                class="op-landing-preview"
                sandbox=""
                :srcdoc="active.landingPageHtml"
              />
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

.op-stage__label {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-stage__toggle {
  font-size: 11px;
  color: var(--op-cta);
  font-weight: 600;
}

.op-stage__body {
  padding: 14px 16px;
  border: 1px solid var(--op-line);
  border-top: none;
  border-radius: 0 0 var(--op-radius-sm) var(--op-radius-sm);
  background: var(--op-panel-2);
}

.op-landing-preview {
  width: 100%;
  height: 520px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  background: #fff;
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

@media (max-width: 720px) {
  .op-layout {
    grid-template-columns: 1fr;
  }
}
</style>
