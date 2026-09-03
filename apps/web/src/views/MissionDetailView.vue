<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import MissionDeliveryPanel from "@/components/MissionDeliveryPanel.vue";
import MissionFlow from "@/components/MissionFlow.vue";
import MissionStatusBadge from "@/components/MissionStatusBadge.vue";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { useMissionDetail } from "@/composables/useMissionDetail";
import { useOffice } from "@/composables/useOffice";
import { cleanMissionObjective } from "@/data/mappers";
import { isActiveMissionStatus } from "@/data/mission-contracts";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { presentationFor } from "@/data/presentation";
import { formatDateTime } from "@/utils/format";
import type { Specialization } from "@/types/office";

const props = defineProps<{ id: string }>();
const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));

const { mission, loading, error, load, reload } = useMissionDetail();
const { employeeById, projects } = useOffice();

watch(
  () => props.id,
  (id) => {
    void load(id);
  },
  { immediate: true },
);

const workspaceName = computed(() => {
  const id = mission.value?.workspaceId;
  if (!id) {
    return "";
  }
  return projects.value.find((project) => project.id === id)?.name ?? id;
});

const ownerEmployeeId = computed(() => {
  const current = mission.value;
  if (!current) {
    return "operaia-ceo";
  }
  const enqueued = current.events.find((event) => event.type === "enqueued");
  const payload = enqueued?.payload;
  if (payload && typeof payload === "object") {
    const owner = (payload as { ownerEmployeeId?: unknown }).ownerEmployeeId;
    if (typeof owner === "string" && owner.length > 0) {
      return owner;
    }
  }
  return current.reply?.employeeId ?? "operaia-ceo";
});

const owner = computed(() => {
  const id = ownerEmployeeId.value;
  const person = employeeById(id);
  if (person) {
    return person;
  }
  return {
    id,
    name: id === "operaia-ceo" ? "Opera" : id,
    emoji: presentationFor("MANAGEMENT").emoji,
    role: "CEO",
    specialtyLabel: presentationFor("MANAGEMENT").specialtyLabel,
  };
});

const live = computed(
  () => mission.value != null && isActiveMissionStatus(mission.value.status),
);

function personName(id: string): string {
  return employeeById(id)?.name ?? (id === "operaia-ceo" ? "Opera" : id === "cto-mag" ? "Mag" : id);
}

function personEmoji(id: string, specialization: string | null): string {
  const person = employeeById(id);
  if (person) {
    return person.emoji;
  }
  if (specialization) {
    return presentationFor(specialization as Specialization).emoji;
  }
  return "👤";
}

/**
 * Traducao humana do event.type — so os tipos conhecidos e realmente
 * emitidos pelo backend (mission-queue.ts / queued-mission-executor.ts).
 * Tipo desconhecido cai no fallback (mostra o proprio type), nunca inventa.
 */
const EVENT_TYPE_LABEL: Record<string, string> = {
  enqueued: "Missão criada e colocada na fila",
  claimed: "Um especialista assumiu a missão",
  tool_used: "Uma ferramenta foi utilizada",
  delivery_created: "Resultado entregue",
  completed: "Missão concluída",
  failed: "Missão encontrou uma falha",
  waiting: "Aguardando próxima etapa",
  recovered: "Missão recuperada após interrupção",
  stale: "Missão sinalizada como parada",
};

function eventEmployeeId(event: { payload?: unknown }): string | undefined {
  const payload = event.payload;
  if (payload && typeof payload === "object" && "employeeId" in payload) {
    const id = (payload as { employeeId?: unknown }).employeeId;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

function humanEventLabel(event: { type: string; payload?: unknown }): string {
  const base = EVENT_TYPE_LABEL[event.type] ?? event.type;
  const employeeId = eventEmployeeId(event);
  if (
    employeeId &&
    (event.type === "claimed" || event.type === "tool_used")
  ) {
    const name = personName(employeeId);
    return event.type === "claimed"
      ? `${name} assumiu a missão`
      : `${name} utilizou uma ferramenta`;
  }
  return base;
}

const team = computed(() => {
  if (!mission.value) {
    return [];
  }
  const rows = [
    {
      id: ownerEmployeeId.value,
      kind: "COORDINATE",
      spec: "MANAGEMENT",
    },
  ];
  for (const child of mission.value.children) {
    if (child.missionKind === "EXECUTE") {
      rows.push({
        id: child.ownerEmployeeId,
        kind: child.missionKind,
        spec: child.requiredSpecialization ?? "SOFTWARE_ENGINEERING",
      });
    }
  }
  const unique = new Map(rows.map((row) => [row.id, row]));
  return [...unique.values()];
});
</script>

<template>
  <OperationalHeader
    :floor="floor"
    scope-line="Missões · Detalhe"
    title="Missão"
    lede="O que foi pedido, quem está trabalhando e o que já foi entregue."
    :show-cta="false"
    :refreshing="loading"
    @refresh="reload"
  >
    <template #extra>
      <span v-if="mission" class="op-pulse">
        <MissionStatusBadge :status="mission.status" />
        <span v-if="live" class="op-pulse__live">
          <span class="op-live-dot" aria-hidden="true" />
          atualizando
        </span>
      </span>
      <router-link :to="`${floor.workRoute}`" class="op-btn">← Trabalhos</router-link>
    </template>
  </OperationalHeader>

  <div class="op-content">
    <p v-if="loading && !mission" class="op-loading">Buscando a missão na API…</p>
    <div v-else-if="error && !mission" class="op-error" role="alert">
      <p class="op-error__title">Missão não disponível</p>
      <p class="op-error__body">{{ error }}</p>
      <button type="button" class="op-btn-retry" @click="load(props.id)">Tentar de novo</button>
    </div>

    <template v-else-if="mission">
      <div class="op-mission-layout">
        <div class="op-mission-layout__main">
          <section class="op-brief">
            <p class="op-eyebrow-sm">O que pedi</p>
            <h2 class="op-brief__title">{{ cleanMissionObjective(mission.objective) }}</h2>
            <p v-if="cleanMissionObjective(mission.objective) !== mission.objective" class="op-brief__raw">
              {{ mission.objective }}
            </p>
            <dl class="op-facts">
              <div>
                <dt>Status</dt>
                <dd><MissionStatusBadge :status="mission.status" /></dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>
                  <router-link
                    v-if="mission.workspaceId"
                    :to="`/app/floor/dev/workspaces/${mission.workspaceId}`"
                    class="op-workspace-link"
                  >
                    {{ workspaceName }}
                  </router-link>
                  <template v-else>{{ workspaceName }}</template>
                </dd>
              </div>
              <div>
                <dt>Responsável</dt>
                <dd>{{ owner.emoji }} {{ owner.name }}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{{ mission.missionKind }}</dd>
              </div>
            </dl>
          </section>

          <MissionDeliveryPanel :mission="mission" class="op-stack-gap" />

          <section v-if="mission.children.length" class="op-kids op-stack-gap">
            <p class="op-eyebrow-sm">Filhos da missão</p>
            <h3 class="op-kids__title">Etapas reais</h3>
            <ul class="op-kids__list">
              <li v-for="child in mission.children" :key="child.id">
                <MissionStatusBadge :status="child.status" />
                <span>{{ personEmoji(child.ownerEmployeeId, child.requiredSpecialization) }}</span>
                <strong>{{ personName(child.ownerEmployeeId) }}</strong>
                <em>{{ child.missionKind }}</em>
                <span>{{ cleanMissionObjective(child.objective) }}</span>
              </li>
            </ul>
          </section>
        </div>

        <aside class="op-mission-layout__rail">
          <section class="op-rail-panel">
            <p class="op-eyebrow-sm">Fluxo</p>
            <h3 class="op-rail-panel__title">Quem está trabalhando</h3>
            <MissionFlow
              class="op-rail-flow"
              :owner-employee-id="ownerEmployeeId"
              :status="mission.status"
              :children="mission.children"
            />
          </section>

          <section class="op-rail-panel op-stack-gap">
            <p class="op-eyebrow-sm">Equipe</p>
            <h3 class="op-rail-panel__title">Envolvidos</h3>
            <ul class="op-team-list">
              <li v-for="member in team" :key="member.id">
                <span class="op-team-face">{{ personEmoji(member.id, member.spec) }}</span>
                <div>
                  <strong>{{ personName(member.id) }}</strong>
                  <span>{{ presentationFor(member.spec as Specialization).specialtyLabel }}</span>
                </div>
              </li>
            </ul>
          </section>

          <section class="op-rail-panel op-stack-gap">
            <p class="op-eyebrow-sm">Atividade</p>
            <h3 class="op-rail-panel__title">Eventos</h3>
            <ol v-if="mission.events.length" class="op-activity-list">
              <li v-for="event in mission.events" :key="event.id">
                <time>{{ formatDateTime(event.createdAt) }}</time>
                <strong>{{ humanEventLabel(event) }}</strong>
                <span>{{ event.message }}</span>
                <code class="op-activity-list__type">{{ event.type }}</code>
              </li>
            </ol>
            <p v-else class="op-empty-inline">Nenhum evento neste response.</p>
          </section>
        </aside>
      </div>
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

.op-pulse {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.op-pulse__live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--op-green);
}

.op-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--op-green);
}

.op-mission-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.9fr);
  gap: 16px;
  align-items: start;
}

.op-stack-gap {
  margin-top: 14px;
}

.op-brief,
.op-kids,
.op-rail-panel {
  padding: 20px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-brief__title,
.op-kids__title,
.op-rail-panel__title {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-brief__raw {
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--op-muted-5);
  white-space: pre-wrap;
}

.op-workspace-link {
  color: var(--op-cta);
  font-weight: 600;
}

.op-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
  margin-top: 16px;
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

.op-rail-flow {
  margin-top: 12px;
}

.op-kids__list,
.op-team-list,
.op-activity-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}

.op-kids__list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--op-line);
  font-size: 13px;
  color: var(--op-ink-3);
}

.op-kids__list em {
  font-style: normal;
  color: var(--op-muted-5);
  font-size: 11px;
}

.op-team-list li {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.op-team-face {
  width: 36px;
  height: 36px;
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  border: 1px solid var(--op-line);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
}

.op-team-list li div {
  display: flex;
  flex-direction: column;
}

.op-team-list li strong {
  font-size: 13px;
  color: var(--op-ink-2);
}

.op-team-list li span {
  margin-top: 2px;
  font-size: 11px;
  color: var(--op-muted-4);
}

.op-activity-list li {
  display: flex;
  flex-direction: column;
  padding: 10px 0;
  border-bottom: 1px solid var(--op-line);
}

.op-activity-list time {
  font-size: 10.5px;
  color: var(--op-muted-5);
}

.op-activity-list strong {
  margin-top: 2px;
  font-size: 13px;
  color: var(--op-ink-2);
}

.op-activity-list span {
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--op-muted-3);
}

.op-activity-list__type {
  margin-top: 4px;
  font-size: 10px;
  color: var(--op-muted-5);
  font-family: var(--op-font-mono);
}

@media (max-width: 980px) {
  .op-mission-layout {
    grid-template-columns: 1fr;
  }
  .op-facts {
    grid-template-columns: 1fr;
  }
}
</style>
