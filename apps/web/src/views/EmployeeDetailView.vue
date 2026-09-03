<script setup lang="ts">
/**
 * Employee drill-down (P1.14A / Parte E).
 * Missões via GET /missions?format=flat&ownerEmployeeId= (P1.14A backend-small).
 * Nenhum modelo novo, nenhuma tabela Agent — roster real vem de useOffice().
 */
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import MissionStatusBadge from "@/components/MissionStatusBadge.vue";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { useOffice } from "@/composables/useOffice";
import { createMissionsClient } from "@/data/adapters/missions-client";
import type { MissionListItemDTO } from "@/data/dto";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { formatDateTime } from "@/utils/format";

const props = defineProps<{ employeeId: string }>();
const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));

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

const executed = computed(() => missions.value.filter((m) => m.missionKind === "EXECUTE"));
const completed = computed(() => missions.value.filter((m) => m.status === "COMPLETED"));
</script>

<template>
  <OperationalHeader
    :floor="floor"
    scope-line="Equipe · Detalhe"
    :title="employee?.name ?? 'Pessoa'"
    lede="Perfil e histórico de missões desta pessoa da equipe digital."
    :show-cta="false"
    :show-refresh="false"
  >
    <template #extra>
      <router-link :to="floor.teamRoute" class="op-btn">← Equipe</router-link>
    </template>
  </OperationalHeader>
  <div class="op-content">
    <p v-if="!employee" class="op-empty-inline">Pessoa não encontrada no roster atual.</p>
    <template v-else>
      <section class="op-profile">
        <div class="op-profile__head">
          <span class="op-profile__avatar">{{ employee.emoji }}</span>
          <div class="op-profile__head-copy">
            <h2 class="op-profile__name">{{ employee.role }} — {{ employee.name }}</h2>
            <p class="op-profile__spec">{{ employee.specialtyLabel }}</p>
          </div>
          <span class="op-status-chip" :class="{ 'op-status-chip--active': employee.active }">
            {{ employee.statusLabel }}
          </span>
        </div>
        <dl class="op-facts">
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

      <section class="op-history">
        <header class="op-history__head">
          <p class="op-eyebrow-sm">Histórico</p>
          <h3 class="op-history__title">Missões</h3>
          <span class="op-history__meta">
            {{ missions.length }} no total · {{ executed.length }} execuções · {{ completed.length }} concluídas
          </span>
        </header>

        <p v-if="state === 'loading'" class="op-loading">Carregando missões…</p>
        <p v-else-if="state === 'error'" class="op-history__error" role="alert">
          Não foi possível carregar as missões desta pessoa agora.
        </p>
        <ul v-else-if="missions.length" class="op-history__list">
          <li v-for="m in missions" :key="m.id">
            <router-link :to="`/app/floor/dev/missions/${m.id}`" class="op-history__item">
              <MissionStatusBadge :status="m.status" />
              <span class="op-history__objective">{{ m.objective }}</span>
              <span class="op-history__ws">{{ workspaceName(m.workspaceId) }}</span>
              <time>{{ formatDateTime(m.createdAt) }}</time>
            </router-link>
          </li>
        </ul>
        <p v-else class="op-empty-inline">Nenhuma missão registrada para esta pessoa ainda.</p>
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

.op-loading,
.op-empty-inline {
  color: var(--op-muted-4);
  font-size: 13px;
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-profile {
  max-width: 720px;
  padding: 20px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  margin-bottom: 16px;
}

.op-profile__head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.op-profile__avatar {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: var(--op-radius);
  background: var(--op-raise);
  border: 1px solid var(--op-line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.op-profile__head-copy {
  min-width: 0;
}

.op-profile__name {
  font-size: 17px;
  font-weight: 700;
  color: var(--op-ink);
}

.op-profile__spec {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--op-muted-3);
}

.op-status-chip {
  margin-left: auto;
  flex-shrink: 0;
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: var(--op-radius-xs);
  background: var(--op-raise);
  color: var(--op-muted-2);
}

.op-status-chip--active {
  color: var(--op-green);
}

.op-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
  margin-top: 18px;
}

.op-facts dt {
  font-size: 10px;
  color: var(--op-muted-5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.op-facts dd {
  margin-top: 4px;
  font-size: 13px;
  color: var(--op-ink-3);
}

.op-history {
  max-width: 720px;
  padding: 20px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-history__title {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-history__meta {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: var(--op-muted-5);
}

.op-history__error {
  margin-top: 14px;
  font-size: 13px;
  color: var(--op-red);
}

.op-history__list {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
}

.op-history__item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--op-line);
  font-size: 13px;
  color: var(--op-ink-3);
  text-decoration: none;
}

.op-history__objective {
  flex: 1;
  min-width: 200px;
}

.op-history__ws,
.op-history__item time {
  font-size: 11px;
  color: var(--op-muted-5);
}

@media (max-width: 768px) {
  .op-profile__head {
    flex-wrap: wrap;
  }
  .op-status-chip {
    margin-left: 0;
    width: 100%;
    text-align: center;
  }
  .op-facts {
    grid-template-columns: 1fr;
  }
}
</style>
