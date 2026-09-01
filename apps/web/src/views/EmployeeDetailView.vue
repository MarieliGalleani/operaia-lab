<script setup lang="ts">
/**
 * Employee drill-down (P1.14A / Parte E).
 * Missões via GET /missions?format=flat&ownerEmployeeId= (P1.14A backend-small).
 * Nenhum modelo novo, nenhuma tabela Agent — roster real vem de useOffice().
 */
import { computed, onMounted, ref, watch } from "vue";
import LoadingState from "@/components/command/LoadingState.vue";
import MissionStatusBadge from "@/components/MissionStatusBadge.vue";
import { useOffice } from "@/composables/useOffice";
import { createMissionsClient } from "@/data/adapters/missions-client";
import type { MissionListItemDTO } from "@/data/dto";
import { formatDateTime } from "@/utils/format";

const props = defineProps<{ employeeId: string }>();

const { employeeById, projects, loaded, load } = useOffice();
const missionsClient = createMissionsClient();

const missions = ref<readonly MissionListItemDTO[]>([]);
const state = ref<"idle" | "loading" | "ready" | "error">("idle");

const employee = computed(() => employeeById(props.employeeId));

function workspaceName(id: string): string {
  return projects.value.find((p) => p.id === id)?.name ?? id;
}

async function loadMissions(id: string): Promise<void> {
  state.value = "loading";
  try {
    missions.value = await missionsClient.listByOwner(id);
    state.value = "ready";
  } catch (error) {
    console.log("[employee-detail] falha ao listar missões", error);
    state.value = "error";
  }
}

onMounted(async () => {
  if (!loaded.value) {
    await load();
  }
  await loadMissions(props.employeeId);
});

watch(
  () => props.employeeId,
  (id) => loadMissions(id),
);

const executed = computed(() =>
  missions.value.filter((m) => m.missionKind === "EXECUTE"),
);
const completed = computed(() =>
  missions.value.filter((m) => m.status === "COMPLETED"),
);
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <router-link to="/app/floor/dev/team" class="back">← Equipe</router-link>
        <h1 class="page__title">{{ employee?.name ?? "Employee" }}</h1>
      </div>
    </header>

    <div class="studio__stage">
      <p v-if="!employee" class="state">Employee não encontrado no roster atual.</p>
      <template v-else>
        <section class="panel profile">
          <div class="profile__head">
            <span class="profile__avatar">{{ employee.emoji }}</span>
            <div>
              <h2>{{ employee.role }} — {{ employee.name }}</h2>
              <p class="profile__spec">{{ employee.specialtyLabel }}</p>
            </div>
            <span class="badge" :class="employee.active ? 'badge--active' : 'badge--planned'">
              {{ employee.statusLabel }}
            </span>
          </div>
          <dl class="facts">
            <div>
              <dt>Trabalho atual</dt>
              <dd>{{ employee.mission || "Nenhum no momento" }}</dd>
            </div>
            <div>
              <dt>Última ação</dt>
              <dd>{{ employee.lastActivity || "—" }}</dd>
            </div>
          </dl>
        </section>

        <section class="panel history">
          <header class="history__head">
            <p class="eyebrow">Histórico</p>
            <h3>Missões</h3>
            <span class="history__meta">
              {{ missions.length }} no total · {{ executed.length }} execuções ·
              {{ completed.length }} concluídas
            </span>
          </header>

          <LoadingState v-if="state === 'loading'" />
          <p v-else-if="state === 'error'" class="history__error" role="alert">
            Não foi possível carregar as missões deste employee agora.
          </p>
          <ul v-else-if="missions.length" class="history__list">
            <li v-for="m in missions" :key="m.id">
              <router-link :to="`/app/floor/dev/missions/${m.id}`" class="history__item">
                <MissionStatusBadge :status="m.status" />
                <span class="history__objective">{{ m.objective }}</span>
                <span class="history__ws">{{ workspaceName(m.workspaceId) }}</span>
                <time>{{ formatDateTime(m.createdAt) }}</time>
              </router-link>
            </li>
          </ul>
          <p v-else class="history__empty">
            Nenhuma missão registrada para este employee ainda.
          </p>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.topbar__left {
  min-width: 180px;
  margin-right: 16px;
}
.back {
  display: inline-block;
  font-size: var(--text-xs);
  color: var(--brand);
  font-weight: 600;
  margin-bottom: 4px;
}
.state {
  padding: 24px;
  color: var(--text-muted);
}
.profile {
  padding: 18px;
  margin-bottom: 16px;
}
.profile__head {
  display: flex;
  align-items: center;
}
.profile__avatar {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-right: 14px;
}
.profile__head h2 {
  font-size: var(--text-lg);
  font-weight: 700;
}
.profile__spec {
  margin-top: 4px;
  font-size: var(--text-sm);
  color: var(--text-soft);
}
.profile__head .badge {
  margin-left: auto;
}
.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-column-gap: 12px;
  grid-row-gap: 10px;
  margin-top: 18px;
}
.facts dt {
  font-size: var(--text-xs);
  color: var(--text-soft);
  text-transform: uppercase;
}
.facts dd {
  margin-top: 4px;
  font-size: var(--text-sm);
}
.history {
  padding: 18px;
}
.history__head h3 {
  margin-top: 4px;
  font-size: var(--text-lg);
  font-weight: 700;
}
.history__meta {
  display: block;
  margin-top: 6px;
  font-size: var(--text-xs);
  color: var(--text-soft);
}
.history__error {
  margin-top: 14px;
  color: var(--danger);
}
.history__empty {
  margin-top: 14px;
  font-size: var(--text-sm);
  color: var(--text-soft);
}
.history__list {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
}
.history__item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: var(--text-sm);
  color: var(--text);
}
.history__item > * {
  margin-right: 10px;
}
.history__objective {
  flex: 1;
  min-width: 200px;
}
.history__ws {
  font-size: var(--text-xs);
  color: var(--text-soft);
}
.history__item time {
  font-size: var(--text-xs);
  color: var(--text-soft);
}

@media (max-width: 768px) {
  .profile__head {
    flex-wrap: wrap;
  }
  .profile__head .badge {
    margin-left: 0;
    margin-top: 10px;
    width: 100%;
  }
  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
