<script setup lang="ts">
/**
 * Fase 5 — O Mural do Escritório: migra pro sistema visual atual
 * (--op-*), junto com MissionCreatePanel/MissionListItem/
 * MissionStatusBadge que esta tela usa.
 */
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import MissionCreatePanel from "@/components/MissionCreatePanel.vue";
import MissionListItem from "@/components/MissionListItem.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { useMissionList } from "@/composables/useMissionList";

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
const { missions, loading, error, refresh } = useMissionList();
const creating = ref(false);
type MissionFilter =
  | "ALL"
  | "IN_PROGRESS"
  | "WAITING"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED";
const filter = ref<MissionFilter>("ALL");

const filteredMissions = computed(() => {
  if (filter.value === "ALL") return missions.value;
  const statusMap: Record<MissionFilter, readonly string[]> = {
    ALL: [],
    IN_PROGRESS: ["CREATED", "QUEUED", "RUNNING"],
    WAITING: ["WAITING"],
    COMPLETED: ["COMPLETED"],
    FAILED: ["FAILED"],
    BLOCKED: ["BLOCKED"],
  };
  return missions.value.filter((item) => statusMap[filter.value].includes(item.status));
});

const openCount = computed(
  () =>
    missions.value.filter((item) =>
      ["CREATED", "QUEUED", "RUNNING", "WAITING"].includes(item.status),
    ).length,
);

onMounted(() => {
  void refresh();
});
</script>

<template>
  <OperationalHeader
    :floor="floor"
    scope-line="Trabalho do escritório"
    title="Meu trabalho"
    lede="Todo pedido que você já fez ao escritório, do envio ao resultado."
    :show-cta="false"
    :refreshing="loading"
    @refresh="refresh"
  >
    <template #extra>
      <div class="op-topbar__pulse" aria-label="Resumo das missões">
        <span><strong>{{ missions.length }}</strong> na lista</span>
        <span><strong>{{ openCount }}</strong> em curso</span>
      </div>
      <button
        type="button"
        class="op-btn"
        title="Modo avançado: pula a triagem de risco e a aprovação"
        @click="creating = true"
      >
        Nova missão (avançado)
      </button>
    </template>
  </OperationalHeader>

  <div class="op-content">
    <MissionCreatePanel v-if="creating" @closed="creating = false" />

    <p v-if="loading && missions.length === 0" class="op-loading">Carregando missões da API…</p>
    <div v-else-if="error" class="op-error" role="alert">
      <p class="op-error__title">Não consegui falar com a API</p>
      <p class="op-error__body">{{ error }}</p>
      <button type="button" class="op-btn-retry" @click="refresh">Tentar de novo</button>
    </div>
    <div v-else-if="missions.length === 0" class="op-error">
      <p class="op-error__title">Você ainda não possui trabalhos</p>
      <p class="op-error__body">
        Peça um trabalho ao escritório para acompanhar a solicitação, a execução e o resultado.
      </p>
      <router-link to="/app/command/new" class="op-btn op-btn--cta">Nova demanda</router-link>
    </div>

    <template v-else>
      <section class="op-filters">
        <div>
          <p class="op-eyebrow-sm">Acompanhar</p>
          <h2 class="op-filters__title">Solicitações por estado</h2>
        </div>
        <label>
          <span class="sr-only">Estado da solicitação</span>
          <select v-model="filter" class="op-select">
            <option value="ALL">Todas</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="WAITING">Aguardando</option>
            <option value="COMPLETED">Entregues</option>
            <option value="FAILED">Com falha</option>
            <option value="BLOCKED">Bloqueadas</option>
          </select>
        </label>
      </section>

      <div v-if="filteredMissions.length">
        <MissionListItem
          v-for="(item, index) in filteredMissions"
          :key="item.id"
          :item="item"
          :index="index"
        />
      </div>
      <p v-else class="op-empty-inline">Nenhum trabalho neste estado. Escolha outro estado ou volte a solicitar um trabalho.</p>
    </template>
  </div>
</template>

<style scoped>
.op-topbar__pulse {
  display: flex;
  gap: 18px;
  font-size: 13px;
  color: var(--op-muted-2);
}

.op-topbar__pulse strong {
  color: var(--op-ink-2);
  font-family: var(--op-font-mono);
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

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
  margin-bottom: 6px;
}

.op-error__body {
  font-size: 12.5px;
  color: var(--op-muted-3);
  margin-bottom: 14px;
}

.op-btn,
.op-btn-retry {
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
  text-decoration: none;
}

.op-btn:hover:not(:disabled),
.op-btn-retry:hover {
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

.op-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  margin-bottom: 16px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-filters__title {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-select {
  min-width: 190px;
  padding: 9px 12px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  color: var(--op-ink-2);
  font: inherit;
}

.op-select:focus {
  outline: none;
  border-color: var(--op-cta);
}

@media (max-width: 900px) {
  .op-topbar {
    flex-wrap: wrap;
  }
  .op-topbar__actions {
    width: 100%;
    margin-left: 0;
  }
  .op-filters {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
  .op-filters label,
  .op-select {
    width: 100%;
  }
}
</style>
