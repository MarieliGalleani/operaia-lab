<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import MissionCreatePanel from "@/components/MissionCreatePanel.vue";
import MissionListItem from "@/components/MissionListItem.vue";
import { useMissionList } from "@/composables/useMissionList";

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
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Trabalho do escritório</p>
        <h1 class="page__title">Meu trabalho</h1>
      </div>
      <div class="studio__pulse" aria-label="Resumo das missões">
        <span class="studio__pulse-item">
          <strong>{{ missions.length }}</strong> na lista
        </span>
        <span class="studio__pulse-item">
          <strong>{{ openCount }}</strong> em curso
        </span>
      </div>
      <div class="topbar__right">
        <button type="button" class="btn btn--ghost" :disabled="loading" @click="refresh">
          Atualizar
        </button>
        <button
          type="button"
          class="btn btn--ghost"
          title="Modo avançado: pula a triagem de risco e a aprovação"
          @click="creating = true"
        >
          Nova missão (avançado)
        </button>
      </div>
    </header>

    <div class="studio__stage">
      <MissionCreatePanel v-if="creating" @closed="creating = false" />

      <p v-if="loading && missions.length === 0" class="state">Carregando missões da API…</p>
      <div v-else-if="error" class="empty-state">
        <p class="empty-state__title">Não consegui falar com a API</p>
        <p class="empty-state__body">{{ error }}</p>
        <button type="button" class="btn btn--primary" @click="refresh">Tentar de novo</button>
      </div>
      <div v-else-if="missions.length === 0" class="empty-state">
        <p class="empty-state__title">Você ainda não possui trabalhos</p>
        <p class="empty-state__body">
          Peça um trabalho ao escritório para acompanhar a solicitação, a execução e o resultado.
        </p>
        <router-link to="/app/command/new" class="btn btn--primary">Nova demanda</router-link>
      </div>

      <template v-else>
        <section class="mission-filters panel" aria-label="Filtrar meu trabalho">
          <div>
            <p class="eyebrow">Acompanhar</p>
            <h2 class="mission-filters__title">Solicitações por estado</h2>
          </div>
          <label>
            <span class="sr-only">Estado da solicitação</span>
            <select v-model="filter">
              <option value="ALL">Todas</option>
              <option value="IN_PROGRESS">Em andamento</option>
              <option value="WAITING">Aguardando</option>
              <option value="COMPLETED">Concluídas</option>
              <option value="FAILED">Com falha</option>
              <option value="BLOCKED">Bloqueadas</option>
            </select>
          </label>
        </section>

      <div v-if="filteredMissions.length" class="list">
        <MissionListItem
          v-for="(item, index) in filteredMissions"
          :key="item.id"
          :item="item"
          :index="index"
        />
      </div>
      <div v-else class="empty-state">
        <p class="empty-state__title">Nenhum trabalho neste estado</p>
        <p class="empty-state__body">Escolha outro estado ou volte a solicitar um trabalho.</p>
      </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.topbar__left {
  min-width: 180px;
  margin-right: 20px;
}

.topbar__right {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.topbar__right .btn--ghost {
  margin-right: 10px;
}

.state {
  padding: 24px;
  color: var(--text-muted);
}

.mission-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  margin-bottom: 16px;
}

.mission-filters__title {
  margin-top: 4px;
  font-size: var(--text-md);
}

.mission-filters select {
  min-width: 190px;
  padding: 9px 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

.list {
  display: flex;
  flex-direction: column;
}

@media (max-width: 900px) {
  .studio__topbar {
    flex-wrap: wrap;
  }
  .topbar__right {
    width: 100%;
    margin-left: 0;
    margin-top: 12px;
  }
  .mission-filters {
    align-items: flex-start;
    flex-direction: column;
  }
  .mission-filters label,
  .mission-filters select {
    width: 100%;
  }
  .mission-filters label {
    margin-top: 12px;
  }
}
</style>
