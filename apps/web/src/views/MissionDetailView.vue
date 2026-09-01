<script setup lang="ts">
import { computed, watch } from "vue";
import MissionDeliveryPanel from "@/components/MissionDeliveryPanel.vue";
import MissionFlow from "@/components/MissionFlow.vue";
import MissionStatusBadge from "@/components/MissionStatusBadge.vue";
import { useMissionDetail } from "@/composables/useMissionDetail";
import { useOffice } from "@/composables/useOffice";
import { cleanMissionObjective } from "@/data/mappers";
import { isActiveMissionStatus } from "@/data/mission-contracts";
import { presentationFor } from "@/data/presentation";
import { formatDateTime } from "@/utils/format";
import type { Specialization } from "@/types/office";

const props = defineProps<{ id: string }>();

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
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <router-link to="/app/missions" class="back">← Missões</router-link>
        <h1 class="page__title">Missão</h1>
      </div>
      <div v-if="mission" class="studio__pulse">
        <span class="studio__pulse-item">
          <MissionStatusBadge :status="mission.status" />
        </span>
        <span v-if="live" class="studio__pulse-item live">
          <span class="live-dot" aria-hidden="true" />
          atualizando
        </span>
      </div>
      <div class="topbar__right">
        <button type="button" class="btn btn--ghost" @click="reload">Atualizar</button>
      </div>
    </header>

    <div class="studio__stage">
      <p v-if="loading && !mission" class="state">Buscando a missão na API…</p>
      <div v-else-if="error && !mission" class="empty-state">
        <p class="empty-state__title">Missão não disponível</p>
        <p class="empty-state__body">{{ error }}</p>
        <button type="button" class="btn btn--primary" @click="load(id)">Tentar de novo</button>
      </div>

      <template v-else-if="mission">
        <div class="layout">
          <div class="layout__main">
            <section class="panel brief">
              <p class="eyebrow">O que pedi</p>
              <h2>{{ cleanMissionObjective(mission.objective) }}</h2>
              <p v-if="cleanMissionObjective(mission.objective) !== mission.objective" class="brief__raw">
                {{ mission.objective }}
              </p>
              <dl class="facts">
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
                      class="workspace-link"
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

            <MissionDeliveryPanel :mission="mission" />

            <section v-if="mission.children.length" class="panel kids">
              <p class="eyebrow">Filhos da missão</p>
              <h3>Etapas reais</h3>
              <ul>
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

          <aside class="layout__rail">
            <section class="panel">
              <p class="eyebrow">Fluxo</p>
              <h3>Quem está trabalhando</h3>
              <MissionFlow
                class="rail-flow"
                :owner-employee-id="ownerEmployeeId"
                :status="mission.status"
                :children="mission.children"
              />
            </section>

            <section class="panel team">
              <p class="eyebrow">Equipe</p>
              <h3>Envolvidos</h3>
              <ul>
                <li v-for="member in team" :key="member.id">
                  <span class="face">{{ personEmoji(member.id, member.spec) }}</span>
                  <div>
                    <strong>{{ personName(member.id) }}</strong>
                    <span>{{ presentationFor(member.spec as Specialization).specialtyLabel }}</span>
                  </div>
                </li>
              </ul>
            </section>

            <section class="panel activity">
              <p class="eyebrow">Atividade</p>
              <h3>Eventos</h3>
              <ol v-if="mission.events.length">
                <li v-for="event in mission.events" :key="event.id">
                  <time>{{ formatDateTime(event.createdAt) }}</time>
                  <strong>{{ humanEventLabel(event) }}</strong>
                  <span>{{ event.message }}</span>
                  <code class="activity__type">{{ event.type }}</code>
                </li>
              </ol>
              <p v-else class="muted">Nenhum evento neste response.</p>
            </section>
          </aside>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.topbar__left {
  min-width: 160px;
  margin-right: 16px;
}

.back {
  display: inline-block;
  font-size: var(--text-xs);
  color: var(--brand);
  font-weight: 600;
  margin-bottom: 4px;
}

.topbar__right {
  margin-left: auto;
}

.live {
  color: var(--success);
}

.state {
  padding: 24px;
  color: var(--text-muted);
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.9fr);
  grid-column-gap: 16px;
  align-items: start;
}

.layout__main > .panel,
.layout__rail > .panel {
  margin-bottom: 14px;
}

.brief,
.kids,
.team,
.activity,
.layout__rail .panel {
  padding: 16px;
}

.brief h2,
.kids h3,
.team h3,
.activity h3,
.layout__rail h3 {
  margin-top: 4px;
  font-size: var(--text-lg);
  font-weight: 700;
}

.brief__raw {
  margin-top: 10px;
  font-size: var(--text-xs);
  color: var(--text-soft);
  white-space: pre-wrap;
}

.workspace-link {
  color: var(--brand);
  font-weight: 600;
}

.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-column-gap: 12px;
  grid-row-gap: 10px;
  margin-top: 16px;
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

.rail-flow {
  margin-top: 12px;
}

.kids ul,
.team ul,
.activity ol {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}

.kids li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: var(--text-sm);
}

.kids li > * {
  margin-right: 8px;
}

.kids em {
  font-style: normal;
  color: var(--text-soft);
  font-size: var(--text-xs);
}

.team li {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.face {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
}

.team li div {
  display: flex;
  flex-direction: column;
}

.team li span {
  margin-top: 2px;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.activity li {
  display: flex;
  flex-direction: column;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.activity time {
  font-size: 11px;
  color: var(--text-soft);
}

.activity strong {
  margin-top: 2px;
  font-size: var(--text-sm);
}

.activity span {
  margin-top: 2px;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.activity__type {
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-soft);
  font-family: ui-monospace, monospace;
}

.muted {
  margin-top: 10px;
  font-size: var(--text-sm);
  color: var(--text-soft);
}

@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .studio__topbar {
    flex-wrap: wrap;
  }
  .topbar__right {
    width: 100%;
    margin: 10px 0 0;
  }
  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
