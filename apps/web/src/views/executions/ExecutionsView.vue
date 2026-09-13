<script setup lang="ts">
/**
 * Fase 5 — O Mural do Escritório: migra do sistema visual antigo
 * (classe .studio/.panel, tokens --text- e --border-strong) pro o
 * --op- usado no resto do escritorio hoje. Mesmo dado, mesma
 * navegacao — so o visual.
 */
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { ExecutionListItem } from "@/data/office-command";

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));

const items = ref<readonly ExecutionListItem[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");

const STATUS_LABEL: Record<ExecutionListItem["status"], string> = {
  PENDING: "Aguardando",
  RUNNING: "Em execução",
  WAITING_APPROVAL: "Aguardando sua aprovação",
  SUCCESS: "Concluída",
  FAILED: "Com falha",
  CANCELLED: "Cancelada",
};

async function loadExecutions(): Promise<void> {
  state.value = "loading";
  try {
    items.value = await officeCommandClient.listExecutions();
    state.value = "ready";
  } catch (error) {
    console.log("[executions] failed", error);
    state.value = "error";
  }
}

onMounted(loadExecutions);
</script>

<template>
  <OperationalHeader
    :floor="floor"
    scope-line="Sistema · Histórico"
    title="Solicitação até resultado"
    lede="Cada execução real, da solicitação ao resultado final."
    :show-cta="false"
    :show-refresh="true"
    @refresh="loadExecutions"
  />
  <div class="op-content">
    <p v-if="state === 'loading'" class="op-loading">Carregando execuções…</p>
    <div v-else-if="state === 'error'" class="op-error" role="alert">
      <p class="op-error__title">Não foi possível carregar o histórico</p>
      <button type="button" class="op-btn-retry" @click="loadExecutions">Tentar de novo</button>
    </div>
    <p v-else-if="items.length === 0" class="op-empty-inline">
      Nenhuma execução ainda. Quando uma automação rodar, o rastro aparece aqui.
    </p>

    <div v-else class="op-exec-grid">
      <router-link
        v-for="item in items"
        :key="item.id"
        :to="`/app/executions/${item.id}`"
        class="op-exec-card"
      >
        <div class="op-exec-card__head">
          <div>
            <p class="op-eyebrow-sm">{{ item.workspaceName }}</p>
            <h3>{{ item.automationName }}</h3>
          </div>
          <span
            class="op-work-card__status"
            :class="{
              'is-green': item.status === 'SUCCESS',
              'is-amber': item.status === 'RUNNING' || item.status === 'WAITING_APPROVAL' || item.status === 'PENDING',
              'is-red': item.status === 'FAILED',
            }"
          >
            {{ STATUS_LABEL[item.status] }}
          </span>
        </div>
        <ol class="op-exec-flow" aria-label="Fluxo da execução">
          <li><span>1</span> Solicitação</li>
          <li><span>2</span> Missão</li>
          <li><span>3</span> Execução</li>
          <li><span>4</span> Resultado</li>
        </ol>
        <p class="op-mono op-exec-date">
          Iniciada em {{ new Date(item.startedAt).toLocaleString("pt-BR") }}
        </p>
      </router-link>
    </div>
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
  font-size: 13px;
  color: var(--op-muted-3);
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
  margin-bottom: 12px;
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

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-exec-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.op-exec-card {
  display: block;
  padding: 16px 18px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.op-exec-card:hover {
  border-color: var(--op-line-strong);
  background: var(--op-hover);
}

.op-exec-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.op-exec-card__head h3 {
  margin: 4px 0 0;
  font-size: 14px;
  font-weight: 700;
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
  white-space: nowrap;
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

.op-exec-flow {
  display: flex;
  flex-wrap: wrap;
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
}

.op-exec-flow li {
  display: flex;
  align-items: center;
  margin: 0 16px 8px 0;
  color: var(--op-muted-3);
  font-size: 11.5px;
}

.op-exec-flow span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: 6px;
  border: 1px solid var(--op-line-strong);
  border-radius: 50%;
  color: var(--op-muted-2);
  font-size: 10.5px;
}

.op-exec-date {
  font-size: 11.5px;
  color: var(--op-muted-4);
}
</style>
