<script setup lang="ts">
/**
 * Aba Trabalhos (P1.21 + P1.X-FIX). Visual fiel ao handoff aprovado,
 * dado real por andar:
 * - Dev: Projects/Workspaces reais (useOffice()).
 * - Automação: Automations reais (officeCommandClient.listAutomations()).
 * - Marketing: nao existe dado real — ver MarketingWorkView.vue.
 *
 * P1.X-FIX:
 * - REG-01: "Novo projeto" volta (dev), via slot #extra do header —
 *   reaproveita a rota existente /workspaces/new, sem endpoint novo.
 * - REG-02: "Nova demanda" volta (CTA padrao do header, antes escondido
 *   com show-cta=false).
 * - REG-03/07/09: refresh real + estados loading/empty/error/success
 *   explicitos — antes uma falha de rede virava silenciosamente
 *   "nenhum trabalho registrado".
 * - REG-13/13B: automacoes agrupadas por prioridade operacional (mesma
 *   hierarquia de AutomationsView.vue), com risco/autonomia/workspace
 *   nos cards (reaproveita RiskBadge/AutonomyBadge, ja existentes e
 *   token-compatíveis) e o catalogo "Em preparação" (dado real de
 *   @/data/automation-capabilities, so a apresentacao mudou).
 */
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import RiskBadge from "@/components/command/RiskBadge.vue";
import AutonomyBadge from "@/components/command/AutonomyBadge.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { useOffice } from "@/composables/useOffice";
import { officeCommandClient } from "@/data/adapters/office-client";
import { PREPARATION_AUTOMATIONS } from "@/data/automation-capabilities";
import type { AutomationListItem, AutomationStatus } from "@/data/office-command";

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
const office = useOffice();

const automations = ref<readonly AutomationListItem[]>([]);
const automationsState = ref<"idle" | "loading" | "ready" | "error">("idle");
const automationsError = ref<string | null>(null);
const refreshing = ref(false);

async function loadAutomations(): Promise<void> {
  automationsState.value = "loading";
  automationsError.value = null;
  try {
    automations.value = await officeCommandClient.listAutomations();
    automationsState.value = "ready";
  } catch (error) {
    automationsError.value =
      error instanceof Error ? error.message : "Não foi possível consultar as automações.";
    automationsState.value = "error";
    console.log("[work-view] falha ao carregar automações", error);
  }
}

async function loadDev(force: boolean): Promise<void> {
  await office.load(force);
}

async function loadForFloor(force = false): Promise<void> {
  if (floor.value.id === "automation") {
    await loadAutomations();
  } else if (floor.value.id === "dev") {
    await loadDev(force);
  }
}

onMounted(() => {
  void loadForFloor();
});

async function refresh(): Promise<void> {
  refreshing.value = true;
  const minDelay = new Promise((resolve) => setTimeout(resolve, 400));
  await Promise.allSettled([loadForFloor(true), minDelay]);
  refreshing.value = false;
}

const viewState = computed<"loading" | "error" | "empty" | "ready">(() => {
  if (floor.value.id === "automation") {
    if (automationsState.value === "loading" || automationsState.value === "idle") return "loading";
    if (automationsState.value === "error") return "error";
    return automations.value.length === 0 ? "empty" : "ready";
  }
  if (office.loading.value && office.projects.value.length === 0) return "loading";
  if (office.error.value && office.projects.value.length === 0) return "error";
  return office.projects.value.length === 0 ? "empty" : "ready";
});

const errorMessage = computed(() =>
  floor.value.id === "automation" ? automationsError.value : office.error.value,
);

const PROJECT_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "ativo", tone: "green" },
  PLANNED: { label: "planejado", tone: "blue" },
  PAUSED: { label: "pausado", tone: "amber" },
  COMPLETED: { label: "concluído", tone: "blue" },
};

function projectTeam(teamIds: readonly string[]) {
  return teamIds
    .map((id) => office.employeeById(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
}

const AUTOMATION_GROUPS: readonly { id: string; title: string; statuses: readonly AutomationStatus[] }[] = [
  { id: "attention", title: "Precisam de atenção", statuses: ["PAUSED", "FAILED"] },
  { id: "running", title: "Em execução", statuses: ["RUNNING", "VALIDATING"] },
  { id: "available", title: "Disponíveis", statuses: ["READY", "ACTIVE"] },
  { id: "other", title: "Outros estados", statuses: ["DRAFT", "PLANNED", "ARCHIVED"] },
];

function automationsIn(statuses: readonly AutomationStatus[]): readonly AutomationListItem[] {
  return automations.value.filter((a) => statuses.includes(a.status));
}

const AUTOMATION_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "rascunho", tone: "muted" },
  PLANNED: { label: "planejado", tone: "blue" },
  READY: { label: "pronto", tone: "blue" },
  RUNNING: { label: "em execução", tone: "green" },
  PAUSED: { label: "pausado", tone: "amber" },
  FAILED: { label: "falhou", tone: "red" },
  VALIDATING: { label: "validando", tone: "blue" },
  ACTIVE: { label: "ativo", tone: "green" },
  ARCHIVED: { label: "arquivado", tone: "muted" },
};
</script>

<template>
  <OperationalHeader
    :floor="floor"
    :scope-line="`${floor.name} · dados isolados`"
    title="Trabalhos"
    lede="Cada repositório, projeto ou automação desta unidade é um trabalho, com seu estado real."
    :refreshing="refreshing"
    :show-cta="floor.id !== 'marketing'"
    @refresh="refresh"
  >
    <template v-if="floor.id === 'dev'" #extra>
      <router-link to="/app/floor/dev/workspaces/new" class="op-btn">Novo projeto</router-link>
    </template>
  </OperationalHeader>

  <div class="op-content">
    <p v-if="viewState === 'loading'" class="op-loading">Carregando trabalhos…</p>

    <div v-else-if="viewState === 'error'" class="op-error" role="alert">
      <p class="op-error__title">Não foi possível carregar os trabalhos</p>
      <p class="op-error__body">{{ errorMessage }}</p>
      <button type="button" class="op-btn-retry" @click="refresh">Tentar de novo</button>
    </div>

    <p v-else-if="viewState === 'empty' && floor.id === 'dev'" class="op-empty-inline">
      Nenhum projeto registrado ainda.
      <router-link to="/app/floor/dev/workspaces/new">Criar o primeiro</router-link>.
    </p>

    <template v-else-if="floor.id === 'dev'">
      <div class="op-work-grid">
        <router-link
          v-for="p in office.projects.value"
          :key="p.id"
          :to="`/app/floor/dev/workspaces/${p.id}`"
          class="op-work-card"
        >
          <div class="op-work-card__head">
            <p class="op-work-card__name">{{ p.name }}</p>
            <span
              class="op-work-card__status"
              :class="`is-${(PROJECT_STATUS_LABEL[p.status] ?? { tone: 'muted' }).tone}`"
            >
              {{ (PROJECT_STATUS_LABEL[p.status] ?? { label: p.status }).label }}
            </span>
          </div>
          <p class="op-work-card__objective">{{ p.objective }}</p>
          <div class="op-progress-track">
            <div class="op-progress-fill" :style="{ width: `${p.progress}%` }" />
          </div>
          <div class="op-work-card__foot">
            <div v-if="projectTeam(p.teamIds).length > 0" class="op-avatars">
              <span
                v-for="e in projectTeam(p.teamIds).slice(0, 5)"
                :key="e.id"
                class="op-avatar-mini"
                :title="`${e.role} — ${e.name}`"
              >{{ e.emoji }}</span>
              <span v-if="projectTeam(p.teamIds).length > 5" class="op-avatar-mini is-more">
                +{{ projectTeam(p.teamIds).length - 5 }}
              </span>
            </div>
            <span class="op-mono op-work-card__pct">{{ p.progress }}%</span>
          </div>
        </router-link>
      </div>
    </template>

    <template v-else-if="floor.id === 'automation'">
      <p v-if="automations.length === 0" class="op-empty-inline">
        Nenhuma automação registrada ainda. As capacidades em preparação abaixo ainda não possuem execução operacional.
      </p>

      <section v-for="group in AUTOMATION_GROUPS" :key="group.id" class="op-group">
        <template v-if="automationsIn(group.statuses).length > 0">
          <h3 class="op-group__title">{{ group.title }}</h3>
          <div class="op-work-grid">
            <router-link
              v-for="a in automationsIn(group.statuses)"
              :key="a.id"
              :to="`/app/floor/automation/automations/${a.id}`"
              class="op-work-card"
            >
              <div class="op-work-card__head">
                <p class="op-work-card__name">{{ a.name }}</p>
                <span
                  class="op-work-card__status"
                  :class="`is-${(AUTOMATION_STATUS_LABEL[a.status] ?? { tone: 'muted' }).tone}`"
                >
                  {{ (AUTOMATION_STATUS_LABEL[a.status] ?? { label: a.status }).label }}
                </span>
              </div>
              <p class="op-work-card__objective">{{ a.objective }}</p>
              <p class="op-mono op-work-card__meta">{{ a.workspaceName }} · {{ a.triggerLabel }}</p>
              <div class="op-badges">
                <RiskBadge :risk="a.risk" />
                <AutonomyBadge :autonomy="a.autonomy" />
              </div>
            </router-link>
          </div>
        </template>
      </section>

      <section class="op-group">
        <p class="op-eyebrow-sm">Ainda não disponível</p>
        <h3 class="op-group__title">Em preparação</h3>
        <div class="op-work-grid">
          <article v-for="cap in PREPARATION_AUTOMATIONS" :key="cap.id" class="op-work-card is-preparation">
            <div class="op-work-card__head">
              <p class="op-work-card__name">{{ cap.name }}</p>
              <span class="op-work-card__status is-muted">em preparação</span>
            </div>
            <p class="op-work-card__objective">{{ cap.description }}</p>
            <p class="op-mono op-work-card__meta">{{ cap.whenToUse }}</p>
            <p class="op-preparation__notice">Ainda não pode ser solicitada. Nenhuma execução foi iniciada.</p>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
}

.op-loading,
.op-empty-inline {
  color: var(--op-muted-4);
  font-size: 13px;
}

.op-empty-inline a {
  color: var(--op-cta);
}

.op-mono {
  font-family: var(--op-font-mono);
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-error {
  max-width: 480px;
  padding: 24px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-error__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin-bottom: 6px;
}

.op-error__body {
  font-size: 12.5px;
  color: var(--op-muted-3);
  margin-bottom: 14px;
}

.op-btn-retry {
  padding: 8px 14px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-raise);
  color: var(--op-ink-2);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.op-btn-retry:hover {
  border-color: var(--op-bd-btn-h);
}

.op-btn-retry:focus-visible {
  outline: 2px solid var(--op-cta);
  outline-offset: 2px;
}

.op-group {
  margin-bottom: 26px;
}

.op-group__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--op-ink-2);
  margin-bottom: 10px;
}

.op-work-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.op-work-card {
  display: block;
  padding: 18px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.op-work-card:hover {
  border-color: var(--op-line-strong);
  background: var(--op-hover);
}

.op-work-card.is-preparation {
  border-style: dashed;
}

.op-work-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.op-work-card__name {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-work-card__status {
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  letter-spacing: 0.08em;
  padding: 2px 7px;
  border-radius: var(--op-radius-xs);
  text-transform: uppercase;
  flex-shrink: 0;
  background: var(--op-raise);
  color: var(--op-muted-2);
}

.op-work-card__status.is-green { color: var(--op-green); background: rgba(74, 222, 128, 0.14); }
.op-work-card__status.is-blue { color: var(--op-blue); background: rgba(96, 165, 250, 0.14); }
.op-work-card__status.is-amber { color: var(--op-amber); background: rgba(251, 191, 36, 0.14); }
.op-work-card__status.is-red { color: var(--op-red); background: rgba(248, 113, 113, 0.12); }
.op-work-card__status.is-muted { color: var(--op-muted-3); }

.op-work-card__objective {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--op-muted-3);
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.op-progress-track {
  height: 3px;
  border-radius: var(--op-radius-full);
  background: var(--op-track);
  overflow: hidden;
  margin-bottom: 12px;
}

.op-progress-fill {
  height: 100%;
  background: var(--op-cta);
  border-radius: var(--op-radius-full);
}

.op-work-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.op-avatars {
  display: flex;
}

.op-avatar-mini {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--op-raise);
  border: 1.5px solid var(--op-panel);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  margin-left: -6px;
}

.op-avatar-mini:first-child {
  margin-left: 0;
}

.op-avatar-mini.is-more {
  font-family: var(--op-font-mono);
  font-size: 9px;
  color: var(--op-muted-3);
}

.op-work-card__pct {
  font-size: 11px;
  color: var(--op-muted-5);
}

.op-work-card__meta {
  font-size: 11px;
  color: var(--op-muted-5);
  margin-bottom: 10px;
}

.op-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.op-preparation__notice {
  margin-top: 4px;
  padding: 8px 10px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  font-size: 11px;
  color: var(--op-muted-4);
}

.op-btn {
  padding: 9px 15px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  background: transparent;
  color: var(--op-muted);
  font-family: "Sora", sans-serif;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.op-btn:hover {
  border-color: var(--op-bd-btn-h);
  color: var(--op-ink-3);
  background: var(--op-raise);
}
</style>
