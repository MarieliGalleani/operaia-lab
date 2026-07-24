<script setup lang="ts">
/**
 * Workspace — tela crítica do lab.
 * Layout decision-first (ref. analytics Olayard): KPIs + deck + board que preenche a viewport.
 */
import { computed, onMounted, ref, watch } from "vue";
import ActivityStream from "@/components/ActivityStream.vue";
import TaskBoard from "@/components/TaskBoard.vue";
import WorkflowViewer from "@/components/WorkflowViewer.vue";
import WorkspaceView from "@/components/WorkspaceView.vue";
import { useOffice } from "@/composables/useOffice";
import type { Workflow } from "@/types/office";

const props = defineProps<{ id: string }>();

const { employeeById, projects, tasks, activities, fetchWorkflow } = useOffice();

const project = computed(() =>
  projects.value.find((item) => item.id === props.id),
);
const projectTasks = computed(() =>
  tasks.value.filter((task) => task.projectId === props.id),
);
const projectActivities = computed(() =>
  activities.value.filter((item) => item.projectId === props.id),
);
const team = computed(() =>
  (project.value?.teamIds ?? [])
    .map((id) => employeeById(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e)),
);

const backlogCount = computed(
  () => projectTasks.value.filter((t) => t.status === "BACKLOG").length,
);
const doingCount = computed(
  () => projectTasks.value.filter((t) => t.status === "IN_PROGRESS").length,
);
const doneCount = computed(
  () => projectTasks.value.filter((t) => t.status === "DONE").length,
);
const openTasks = computed(() => backlogCount.value + doingCount.value);

const workflow = ref<Workflow | undefined>(undefined);

async function loadWorkflow(id: string): Promise<void> {
  workflow.value = await fetchWorkflow(id);
}

onMounted(() => loadWorkflow(props.id));
watch(
  () => props.id,
  (id) => loadWorkflow(id),
);
</script>

<template>
  <div class="ws-page" :class="{ 'ws-page--ready': Boolean(project) }">
    <header class="topbar">
      <div class="topbar__left">
        <router-link to="/office/projetos" class="topbar__back">← Projetos</router-link>
        <h1 v-if="project" class="topbar__title">{{ project.name }}</h1>
        <h1 v-else class="topbar__title">Workspace</h1>
      </div>

      <div v-if="project" class="topbar__center">
        <div class="focus">
          <span class="focus__label">Status</span>
          <span class="focus__name">{{ project.status }}</span>
        </div>
        <div class="pulse">
          <span class="pulse__item"><strong>{{ project.progress }}%</strong> progresso</span>
          <span class="pulse__item"><strong>{{ openTasks }}</strong> abertas</span>
          <span class="pulse__item"><strong>{{ team.length }}</strong> na equipe</span>
        </div>
      </div>

      <div class="topbar__right">
        <div class="crew" aria-label="Equipe do workspace">
          <span
            v-for="member in team"
            :key="member.id"
            class="crew__face"
            :title="`${member.role} — ${member.name}`"
          >
            {{ member.emoji }}
          </span>
        </div>
        <router-link to="/office/sala-ceo" class="btn btn--primary">Com Opera</router-link>
      </div>
    </header>

    <template v-if="project">
      <section class="kpi-strip">
        <article class="kpi-card panel card-motion" style="--d: 1">
          <p class="kpi-card__label">Progresso</p>
          <p class="kpi-card__value">{{ project.progress }}%</p>
          <div class="meter"><span :style="{ width: `${project.progress}%` }" /></div>
          <p class="kpi-card__hint">objetivo do workspace</p>
        </article>
        <article class="kpi-card panel card-motion" style="--d: 2">
          <p class="kpi-card__label">Backlog</p>
          <p class="kpi-card__value">{{ backlogCount }}</p>
          <p class="kpi-card__hint">aguardando execução</p>
        </article>
        <article class="kpi-card panel card-motion" style="--d: 3">
          <p class="kpi-card__label">Em andamento</p>
          <p class="kpi-card__value">{{ doingCount }}</p>
          <p class="kpi-card__hint">fluxo ativo agora</p>
        </article>
        <article class="kpi-card panel card-motion" style="--d: 4">
          <p class="kpi-card__label">Concluídas</p>
          <p class="kpi-card__value">{{ doneCount }}</p>
          <p class="kpi-card__hint">de {{ projectTasks.length }} tarefas</p>
        </article>
      </section>

      <div class="deck">
        <section class="deck__main">
          <WorkspaceView :project="project" class="card-motion" style="--d: 5" />

          <div class="board-wrap panel card-motion" style="--d: 6">
            <header class="board-wrap__head">
              <div>
                <p class="eyebrow">Kanban</p>
                <h2>Tarefas</h2>
              </div>
              <span class="board-wrap__meta">{{ projectTasks.length }} no fluxo</span>
            </header>
            <TaskBoard :tasks="projectTasks" fill />
          </div>
        </section>

        <aside class="deck__rail">
          <div class="card-motion" style="--d: 7">
            <WorkflowViewer v-if="workflow" :workflow="workflow" />
            <article v-else class="panel rail-empty">
              <p class="eyebrow">Workflow</p>
              <p class="rail-empty__body">Sem fluxo registrado ainda — peça um plano à Opera.</p>
              <router-link to="/office/sala-ceo" class="btn btn--ghost">Abrir Sala da CEO</router-link>
            </article>
          </div>

          <section class="rail-feed panel card-motion" style="--d: 8">
            <header class="rail-feed__head">
              <div>
                <p class="eyebrow">Pulso</p>
                <h3>Histórico</h3>
              </div>
              <span class="live-dot" aria-hidden="true" />
            </header>
            <div class="rail-feed__body">
              <ActivityStream :activities="projectActivities" />
              <div v-if="projectActivities.length === 0" class="rail-empty-state">
                <p class="rail-empty-state__title">Sem movimento ainda</p>
                <p class="rail-empty-state__body">
                  Quando a equipe agir neste workspace, o feed aparece aqui.
                </p>
                <router-link to="/office/atividades" class="btn btn--ghost">Ver atividades do lab</router-link>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </template>

    <p v-else class="missing">Workspace não encontrado.</p>
  </div>
</template>

<style scoped>
.ws-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 0 0 16px;
  animation: rise-in 0.45s var(--ease) both;
}

.topbar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  background:
    radial-gradient(ellipse at 0% 0%, rgba(59, 130, 246, 0.14), transparent 42%),
    radial-gradient(ellipse at 100% 0%, rgba(56, 189, 248, 0.06), transparent 36%),
    linear-gradient(180deg, #0c1424 0%, var(--bg) 100%);
}

.topbar__left {
  min-width: 160px;
  margin-right: 16px;
}

.topbar__back {
  display: inline-block;
  font-size: var(--text-xs);
  color: var(--brand);
  font-weight: 600;
  margin-bottom: 4px;
}

.topbar__title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.topbar__center {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.focus {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 12px;
  background:
    linear-gradient(165deg, rgba(30, 48, 80, 0.4), transparent 50%),
    rgba(14, 21, 36, 0.72);
  border: 1px solid var(--border);
  margin-right: 12px;
}

.focus__label {
  font-size: var(--text-xs);
  color: var(--text-soft);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-right: 10px;
}

.focus__name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--brand);
}

.pulse {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.pulse__item {
  display: inline-flex;
  align-items: baseline;
  margin-right: 8px;
  margin-top: 2px;
  padding: 7px 11px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background:
    linear-gradient(165deg, rgba(30, 48, 80, 0.4), transparent 50%),
    rgba(14, 21, 36, 0.72);
  font-size: 12px;
  color: var(--text-muted);
}

.pulse__item strong {
  color: var(--text);
  font-weight: 700;
  margin-right: 5px;
  font-size: 15px;
}

.topbar__right {
  display: flex;
  align-items: center;
  margin-left: 12px;
}

.crew {
  display: flex;
  align-items: center;
  margin-right: 12px;
}

.crew__face {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 2px solid var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  margin-left: -8px;
}

.crew__face:first-child {
  margin-left: 0;
}

.kpi-strip {
  flex-shrink: 0;
  padding: 0 20px;
}

.deck {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.85fr);
  grid-column-gap: 14px;
  flex: 1;
  min-height: 0;
  margin-top: 8px;
  padding: 0 20px;
  align-items: stretch;
}

.deck__main {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.deck__rail {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.board-wrap {
  flex: 1;
  min-height: 280px;
  margin-top: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
}

.board-wrap :deep(.board--fill) {
  flex: 1;
  min-height: 0;
}

.board-wrap__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.board-wrap__head h2 {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 600;
}

.board-wrap__meta {
  font-size: 11px;
  color: var(--text-soft);
}

.rail-feed {
  flex: 1;
  min-height: 160px;
  margin-top: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
}

.rail-feed__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.rail-feed__head h3 {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 600;
}

.rail-feed__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.rail-empty {
  padding: 14px;
}

.rail-empty__body {
  margin-top: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-muted);
}

.rail-empty-state {
  padding: 20px 8px;
  text-align: center;
}

.rail-empty-state__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.rail-empty-state__body {
  margin-top: 6px;
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--text-muted);
}

.missing {
  padding: 28px;
  font-size: var(--text-sm);
  color: var(--text-soft);
}

@media (max-width: 1100px) {
  .deck {
    grid-template-columns: 1fr;
    grid-row-gap: 12px;
  }
  .rail-feed {
    min-height: 220px;
  }
}

@media (max-width: 900px) {
  .topbar {
    flex-wrap: wrap;
  }
  .topbar__left,
  .topbar__center,
  .topbar__right {
    width: 100%;
    margin: 0 0 10px;
  }
  .kpi-strip {
    padding: 0 14px;
  }
  .deck {
    padding: 0 14px;
  }
}
</style>
