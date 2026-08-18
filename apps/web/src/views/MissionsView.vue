<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import MissionCreatePanel from "@/components/MissionCreatePanel.vue";
import MissionStatusBadge from "@/components/MissionStatusBadge.vue";
import { useMissionList } from "@/composables/useMissionList";
import { useOffice } from "@/composables/useOffice";
import { cleanMissionObjective } from "@/data/mappers";
import { presentationFor } from "@/data/presentation";
import { formatDateTime } from "@/utils/format";
import type { MissionTreeNodeDTO } from "@/data/mission-contracts";
import type { Specialization } from "@/types/office";

const { missions, loading, error, refresh } = useMissionList();
const { employeeById, projects } = useOffice();
const creating = ref(false);

const openCount = computed(
  () =>
    missions.value.filter((item) =>
      ["CREATED", "QUEUED", "RUNNING", "WAITING"].includes(item.status),
    ).length,
);

function workspaceName(id: string): string {
  return projects.value.find((project) => project.id === id)?.name ?? id;
}

function ownerName(id: string): string {
  return employeeById(id)?.name ?? (id === "operaia-ceo" ? "Opera" : id);
}

function ownerEmoji(id: string): string {
  const person = employeeById(id);
  if (person) {
    return person.emoji;
  }
  return id === "operaia-ceo" ? presentationFor("MANAGEMENT").emoji : "👤";
}

function specialists(root: MissionTreeNodeDTO): readonly string[] {
  const people = new Map<string, string>();
  function walk(node: MissionTreeNodeDTO): void {
    if (node.missionKind === "EXECUTE") {
      const person = employeeById(node.ownerEmployeeId);
      const spec = node.requiredSpecialization as Specialization | null;
      const label = person?.name ?? node.ownerEmployeeId;
      const emoji = person?.emoji ?? (spec ? presentationFor(spec).emoji : "👤");
      people.set(node.ownerEmployeeId, `${emoji} ${label}`);
    }
    for (const child of node.children) {
      walk(child);
    }
  }
  walk(root);
  return [...people.values()];
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Trabalho do escritório</p>
        <h1 class="page__title">Missões</h1>
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
        <button type="button" class="btn btn--primary" @click="creating = true">
          Nova missão
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
        <p class="empty-state__title">Nenhuma missão ainda</p>
        <p class="empty-state__body">
          Peça um trabalho ao escritório. A lista vem de GET /api/v1/missions — sem mock.
        </p>
        <button type="button" class="btn btn--primary" @click="creating = true">
          Nova missão
        </button>
      </div>

      <div v-else class="list">
        <router-link
          v-for="(item, index) in missions"
          :key="item.id"
          :to="`/app/office/missions/${item.id}`"
          class="card panel card-motion"
          :style="{ '--d': index + 1 }"
        >
          <header class="card__head">
            <MissionStatusBadge :status="item.status" />
            <time>{{ formatDateTime(item.createdAt) }}</time>
          </header>
          <h2>{{ cleanMissionObjective(item.objective) }}</h2>
          <dl class="meta">
            <div>
              <dt>Responsável</dt>
              <dd>{{ ownerEmoji(item.ownerEmployeeId) }} {{ ownerName(item.ownerEmployeeId) }}</dd>
            </div>
            <div>
              <dt>Workspace</dt>
              <dd>{{ workspaceName(item.workspaceId) }}</dd>
            </div>
            <div>
              <dt>Especialista(s)</dt>
              <dd>{{ specialists(item).join(" · ") || "Ainda sem delegação" }}</dd>
            </div>
            <div>
              <dt>Resultado</dt>
              <dd>
                {{ item.status === "COMPLETED" ? "Disponível no detalhe" : "Ainda não" }}
              </dd>
            </div>
          </dl>
        </router-link>
      </div>
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

.list {
  display: flex;
  flex-direction: column;
}

.card {
  display: block;
  padding: 16px 18px;
  margin-bottom: 12px;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s var(--ease), transform 0.2s var(--ease);
}

.card:hover {
  border-color: var(--brand-line);
  transform: translateY(-1px);
}

.card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card__head time {
  font-size: var(--text-xs);
  color: var(--text-soft);
}

.card h2 {
  margin-top: 10px;
  font-size: var(--text-md);
  font-weight: 600;
  line-height: 1.4;
}

.meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-column-gap: 12px;
  grid-row-gap: 10px;
  margin-top: 14px;
}

.meta dt {
  font-size: var(--text-xs);
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.meta dd {
  margin-top: 4px;
  font-size: var(--text-sm);
  color: var(--text-muted);
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
  .meta {
    grid-template-columns: 1fr;
  }
}
</style>
