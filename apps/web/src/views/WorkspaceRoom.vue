<script setup lang="ts">
/**
 * Workspace — tela crítica do lab.
 * Layout decision-first (ref. analytics Olayard): KPIs + deck + board que preenche a viewport.
 */
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import ActivityStream from "@/components/ActivityStream.vue";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import TaskBoard from "@/components/TaskBoard.vue";
import WorkflowViewer from "@/components/WorkflowViewer.vue";
import WorkspaceView from "@/components/WorkspaceView.vue";
import { useOffice } from "@/composables/useOffice";
import { createMissionsClient } from "@/data/adapters/missions-client";
import { officeCommandClient } from "@/data/adapters/office-client";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import type {
  ApprovalListItem,
  AutomationListItem,
  DecisionTraceDto,
  ExecutionListItem,
} from "@/data/office-command";
import type { MissionTreeNodeDTO } from "@/data/mission-contracts";
import type { WorkspaceContextDto } from "@/data/office-command";
import type { Workflow } from "@/types/office";

const missionsClient = createMissionsClient();

const props = defineProps<{ id: string }>();
const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));

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

const workflow = ref<Workflow | undefined>(undefined);
const officeContext = ref<WorkspaceContextDto | null>(null);
const contextState = ref<"idle" | "loading" | "ready" | "error">("idle");
const contextError = ref("Não foi possível carregar o contexto oficial do Office.");

/**
 * Trabalho do projeto (P1.14A / Parte A — Project Hub).
 * Reaproveita os endpoints já existentes com filtro ?workspaceId=,
 * confirmado disponível em /missions, /office/executions, /office/decisions,
 * /office/approvals e /office/automations (P1.13A). Nenhum endpoint novo.
 */
const projectMissions = ref<readonly MissionTreeNodeDTO[]>([]);
const projectExecutions = ref<readonly ExecutionListItem[]>([]);
const projectDecisions = ref<readonly DecisionTraceDto[]>([]);
const projectApprovals = ref<readonly ApprovalListItem[]>([]);
const projectAutomations = ref<readonly AutomationListItem[]>([]);
const workState = ref<"idle" | "loading" | "ready" | "error">("idle");

async function loadWorkflow(id: string): Promise<void> {
  workflow.value = await fetchWorkflow(id);
}

async function loadProjectWork(id: string): Promise<void> {
  workState.value = "loading";
  try {
    const [missions, executions, decisions, approvals, automations] =
      await Promise.all([
        missionsClient.listTree(20, id),
        officeCommandClient.listExecutions(id),
        officeCommandClient.listDecisions(id),
        officeCommandClient.listApprovals(id),
        officeCommandClient.listAutomations(id),
      ]);
    projectMissions.value = missions;
    projectExecutions.value = executions;
    projectDecisions.value = decisions;
    projectApprovals.value = approvals;
    projectAutomations.value = automations;
    workState.value = "ready";
  } catch (error) {
    console.log("[workspace] trabalho do projeto indisponível", error);
    workState.value = "error";
  }
}

async function loadOfficeContext(id: string, fallbackName?: string): Promise<void> {
  contextState.value = "loading";
  contextError.value = "Não foi possível carregar o contexto oficial do Office.";
  try {
    officeContext.value = await officeCommandClient.getWorkspaceContext(
      id,
      fallbackName ?? id,
    );
    contextState.value = "ready";
  } catch (error) {
    console.log("[workspace] office context failed", error);
    officeContext.value = null;
    contextState.value = "error";
  }
}

async function loadWorkspace(id: string): Promise<void> {
  await loadWorkflow(id);
  const name = projects.value.find((p) => p.id === id)?.name;
  await Promise.all([loadOfficeContext(id, name), loadProjectWork(id)]);
}

onMounted(() => loadWorkspace(props.id));
watch(
  () => props.id,
  (id) => loadWorkspace(id),
);
</script>

<template>
  <OperationalHeader
    :floor="floor"
    scope-line="Trabalhos · Detalhe"
    :title="project?.name ?? 'Projeto'"
    lede="O que a OperaIA sabe e está fazendo neste projeto agora."
    :show-cta="false"
    :show-refresh="false"
  >
    <template #extra>
      <div v-if="project" class="op-crew" aria-label="Equipe do workspace">
        <span
          v-for="member in team"
          :key="member.id"
          class="op-crew__face"
          :title="`${member.role} — ${member.name}`"
        >
          {{ member.emoji }}
        </span>
      </div>
      <router-link
        v-if="project"
        :to="{ path: '/app/floor/dev/command/new', query: { workspace: project.id } }"
        class="op-btn op-btn--cta"
      >
        Nova demanda
      </router-link>
      <router-link :to="floor.workRoute" class="op-btn">← Trabalhos</router-link>
    </template>
  </OperationalHeader>

  <div class="op-content">
    <template v-if="project">
      <section class="op-ctx">
        <span class="op-status-chip" :class="{ 'op-status-chip--active': officeContext?.kind === 'lab' }">
          {{ officeContext?.kind === "lab" ? "OperaIA.lab" : "Cliente / Workspace" }}
        </span>
        <strong class="op-ctx__name">{{ officeContext?.name ?? project.name }}</strong>
        <span class="op-ctx__sep">·</span>
        <span class="op-ctx__status">{{ officeContext?.statusLabel ?? `Status ${project.status}` }}</span>
        <span class="op-ctx__sep">·</span>
        <router-link
          :to="{ path: '/app/floor/dev/command/new', query: { workspace: project.id } }"
          class="op-ctx__link"
        >
          Nova demanda neste workspace
        </router-link>

        <p v-if="contextState === 'loading'" class="op-loading op-ctx__full">Carregando contexto Office…</p>
        <p v-else-if="contextState === 'error'" class="op-ctx__error op-ctx__full" role="alert">
          {{ contextError }}
          <button type="button" class="op-btn-retry" @click="loadOfficeContext(project.id, project.name)">
            Tentar de novo
          </button>
        </p>
        <div v-else-if="contextState === 'ready' && officeContext" class="op-ctx__office op-ctx__full">
          <p class="op-ctx__counts" aria-label="Contagens oficiais">
            <span><strong>{{ officeContext.automationsActive }}</strong> automações ativas</span>
            <span><strong>{{ officeContext.missionsOpen }}</strong> missões abertas</span>
            <span><strong>{{ officeContext.decisionsRecent }}</strong> decisões (7d)</span>
            <span><strong>{{ officeContext.approvalsPending }}</strong> aprovações pendentes</span>
          </p>
          <p class="op-ctx__hint">Credenciais: valores nunca exibidos — apenas status configurado.</p>
          <ul v-if="officeContext.integrations.length" class="op-ctx__list" aria-label="Integrações">
            <li v-for="item in officeContext.integrations" :key="item.id">
              {{ item.label }} · {{ item.configured ? "configurada" : "pendente" }}
            </li>
          </ul>
          <ul v-if="officeContext.credentials.length" class="op-ctx__list" aria-label="Credenciais">
            <li v-for="item in officeContext.credentials" :key="item.id">
              {{ item.label }} · {{ item.configured ? "configurada" : "pendente" }}
            </li>
          </ul>
          <p
            v-if="!officeContext.integrations.length && !officeContext.credentials.length"
            class="op-ctx__empty"
          >
            Nenhuma integração ou credencial registrada neste workspace.
          </p>
        </div>
      </section>

      <section class="op-panel-block op-stack-gap">
        <p class="op-eyebrow-sm">Contexto</p>
        <h2 class="op-panel-block__title">O que a OperaIA sabe sobre este projeto</h2>
        <div class="op-context-grid">
          <article>
            <h3>Objetivo</h3>
            <p v-if="project.projectObjective">{{ project.projectObjective }}</p>
            <p v-else class="op-empty-inline">Nenhum objetivo definido ainda.</p>
          </article>
          <article>
            <h3>Contexto</h3>
            <p v-if="project.projectContext">{{ project.projectContext }}</p>
            <p v-else class="op-empty-inline">Nenhum contexto registrado ainda.</p>
          </article>
          <article>
            <h3>Restrições</h3>
            <p v-if="project.projectConstraints">{{ project.projectConstraints }}</p>
            <p v-else class="op-empty-inline">Nenhuma restrição registrada ainda.</p>
          </article>
        </div>
      </section>

      <section class="op-panel-block op-stack-gap">
        <p class="op-eyebrow-sm">Trabalho</p>
        <h2 class="op-panel-block__title">O que está acontecendo neste projeto</h2>
        <p v-if="workState === 'loading'" class="op-loading">Carregando trabalho do projeto…</p>
        <p v-else-if="workState === 'error'" class="op-work-error" role="alert">
          Não foi possível carregar o trabalho deste projeto agora.
        </p>
        <div v-else class="op-work-grid">
          <article class="op-pw-card">
            <header><h3>Demandas</h3></header>
            <p class="op-pw-card__unavailable">
              Ainda não é possível listar demandas por projeto — essa capacidade não existe hoje no backend (P1.13B).
            </p>
          </article>

          <article class="op-pw-card">
            <header>
              <h3>Missões</h3>
              <span class="op-pw-card__count">{{ projectMissions.length }}</span>
            </header>
            <ul v-if="projectMissions.length" class="op-pw-card__list">
              <li v-for="m in projectMissions.slice(0, 5)" :key="m.id">
                <router-link :to="`/app/floor/dev/missions/${m.id}`">{{ m.objective.slice(0, 60) }}</router-link>
              </li>
            </ul>
            <p v-else class="op-pw-card__empty">Nenhuma missão neste projeto ainda.</p>
            <router-link to="/app/floor/dev/missions" class="op-pw-card__more">Ver todas as missões →</router-link>
          </article>

          <article class="op-pw-card">
            <header>
              <h3>Execuções</h3>
              <span class="op-pw-card__count">{{ projectExecutions.length }}</span>
            </header>
            <ul v-if="projectExecutions.length" class="op-pw-card__list">
              <li v-for="e in projectExecutions.slice(0, 5)" :key="e.id">
                <router-link :to="`/app/floor/dev/executions/${e.id}`">{{ e.automationName }} · {{ e.status }}</router-link>
              </li>
            </ul>
            <p v-else class="op-pw-card__empty">Nenhuma execução neste projeto ainda.</p>
          </article>

          <article class="op-pw-card">
            <header>
              <h3>Decisões</h3>
              <span class="op-pw-card__count">{{ projectDecisions.length }}</span>
            </header>
            <ul v-if="projectDecisions.length" class="op-pw-card__list">
              <li v-for="d in projectDecisions.slice(0, 5)" :key="d.decisionId">
                <router-link :to="`/app/floor/dev/decisions/${d.decisionId}`">{{ d.objective.slice(0, 60) }}</router-link>
              </li>
            </ul>
            <p v-else class="op-pw-card__empty">Nenhuma decisão neste projeto ainda.</p>
          </article>

          <article class="op-pw-card">
            <header>
              <h3>Aprovações</h3>
              <span class="op-pw-card__count">{{ projectApprovals.length }}</span>
            </header>
            <ul v-if="projectApprovals.length" class="op-pw-card__list">
              <li v-for="a in projectApprovals.slice(0, 5)" :key="a.id">
                <router-link :to="`/app/floor/dev/command/approvals/${a.id}`">{{ a.title.slice(0, 60) }} · {{ a.status }}</router-link>
              </li>
            </ul>
            <p v-else class="op-pw-card__empty">Nenhuma aprovação neste projeto.</p>
          </article>

          <article class="op-pw-card">
            <header>
              <h3>Automações</h3>
              <span class="op-pw-card__count">{{ projectAutomations.length }}</span>
            </header>
            <ul v-if="projectAutomations.length" class="op-pw-card__list">
              <li v-for="a in projectAutomations.slice(0, 5)" :key="a.id">
                <router-link :to="`/app/floor/automation/automations/${a.id}`">{{ a.name }}</router-link>
              </li>
            </ul>
            <p v-else class="op-pw-card__empty">Nenhuma automação neste projeto.</p>
          </article>
        </div>
      </section>

      <section class="op-kpi-strip op-stack-gap">
        <article class="op-kpi-card">
          <p class="op-kpi-card__label">Progresso</p>
          <p class="op-kpi-card__value">{{ project.progress }}%</p>
          <div class="op-meter"><span :style="{ width: `${project.progress}%` }" /></div>
          <p class="op-kpi-card__hint">objetivo do workspace</p>
        </article>
        <article class="op-kpi-card">
          <p class="op-kpi-card__label">Backlog</p>
          <p class="op-kpi-card__value">{{ backlogCount }}</p>
          <p class="op-kpi-card__hint">aguardando execução</p>
        </article>
        <article class="op-kpi-card">
          <p class="op-kpi-card__label">Em andamento</p>
          <p class="op-kpi-card__value">{{ doingCount }}</p>
          <p class="op-kpi-card__hint">fluxo ativo agora</p>
        </article>
        <article class="op-kpi-card">
          <p class="op-kpi-card__label">Concluídas</p>
          <p class="op-kpi-card__value">{{ doneCount }}</p>
          <p class="op-kpi-card__hint">de {{ projectTasks.length }} tarefas</p>
        </article>
      </section>

      <div class="op-deck op-stack-gap">
        <section class="op-deck__main">
          <WorkspaceView :project="project" />

          <div class="op-board-wrap op-stack-gap">
            <header class="op-board-wrap__head">
              <div>
                <p class="op-eyebrow-sm">Kanban</p>
                <h2>Tarefas</h2>
              </div>
              <span class="op-board-wrap__meta">{{ projectTasks.length }} no fluxo</span>
            </header>
            <TaskBoard :tasks="projectTasks" fill />
          </div>
        </section>

        <aside class="op-deck__rail">
          <WorkflowViewer v-if="workflow" :workflow="workflow" />
          <article v-else class="op-rail-empty">
            <p class="op-eyebrow-sm">Workflow</p>
            <p class="op-rail-empty__body">Sem fluxo registrado ainda — peça um plano à Opera.</p>
            <router-link to="/app/office/sala-ceo" class="op-btn">Abrir Sala da CEO</router-link>
          </article>

          <section class="op-rail-feed op-stack-gap">
            <header class="op-rail-feed__head">
              <div>
                <p class="op-eyebrow-sm">Pulso</p>
                <h3>Histórico</h3>
              </div>
              <span class="op-live-dot" aria-hidden="true" />
            </header>
            <div class="op-rail-feed__body">
              <ActivityStream :activities="projectActivities" />
              <div v-if="projectActivities.length === 0" class="op-rail-empty-state">
                <p class="op-rail-empty-state__title">Sem movimento ainda</p>
                <p class="op-rail-empty-state__body">
                  Quando a equipe agir neste workspace, o feed aparece aqui.
                </p>
                <router-link to="/app/office/atividades" class="op-btn">Ver atividades do lab</router-link>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </template>

    <p v-else class="op-empty-inline">Workspace não encontrado.</p>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
}

.op-stack-gap {
  margin-top: 16px;
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

.op-btn:hover:not(:disabled) {
  border-color: var(--op-bd-btn-h);
  color: var(--op-ink-3);
  background: var(--op-raise);
}

.op-btn--cta {
  border-color: var(--op-cta);
  background: var(--op-cta);
  color: #fff;
  font-weight: 600;
}

.op-btn--cta:hover:not(:disabled) {
  background: var(--op-cta-h);
  border-color: var(--op-cta-h);
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

.op-crew {
  display: flex;
  align-items: center;
}

.op-crew__face {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--op-raise);
  border: 2px solid var(--op-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  margin-left: -8px;
}

.op-crew__face:first-child {
  margin-left: 0;
}

.op-ctx {
  padding: 14px 18px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.op-ctx__name {
  font-size: 13px;
  color: var(--op-ink-2);
  margin-right: 10px;
}

.op-ctx__sep {
  margin: 0 8px;
  color: var(--op-muted-5);
}

.op-ctx__status {
  font-size: 12.5px;
  color: var(--op-muted-3);
}

.op-ctx__link {
  font-size: 12.5px;
  color: var(--op-cta);
  font-weight: 600;
}

.op-ctx__full {
  flex-basis: 100%;
  margin-top: 10px;
}

.op-ctx__error {
  color: var(--op-red);
  font-size: 12.5px;
}

.op-ctx__error .op-btn-retry {
  margin-left: 8px;
}

.op-ctx__counts {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  font-size: 12.5px;
  color: var(--op-muted-3);
}

.op-ctx__counts span {
  margin-right: 16px;
  margin-bottom: 4px;
}

.op-ctx__counts strong {
  color: var(--op-ink-2);
}

.op-ctx__hint {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--op-muted-5);
}

.op-ctx__list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 12.5px;
  color: var(--op-muted-3);
}

.op-ctx__list li {
  margin-bottom: 2px;
}

.op-ctx__empty {
  margin: 8px 0 0;
  font-size: 12.5px;
  color: var(--op-muted-5);
}

.op-status-chip {
  margin-right: 10px;
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

.op-panel-block {
  padding: 20px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-panel-block__title {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-context-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.op-context-grid article {
  padding: 12px 14px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-line);
  background: var(--op-raise);
}

.op-context-grid h3 {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--op-muted-5);
}

.op-context-grid p {
  margin-top: 8px;
  font-size: 13px;
  color: var(--op-ink-3);
  white-space: pre-wrap;
}

.op-work-error {
  margin-top: 12px;
  font-size: 13px;
  color: var(--op-red);
}

.op-work-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.op-pw-card {
  padding: 12px 14px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-line);
  background: var(--op-raise);
}

.op-pw-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.op-pw-card h3 {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-pw-card__count {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--op-cta);
  background: var(--op-sel);
  border-radius: var(--op-radius-full);
  padding: 2px 8px;
}

.op-pw-card__list {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
}

.op-pw-card__list li {
  margin-bottom: 6px;
  font-size: 11.5px;
}

.op-pw-card__list a {
  color: var(--op-ink-3);
}

.op-pw-card__list a:hover {
  color: var(--op-cta);
}

.op-pw-card__empty,
.op-pw-card__unavailable {
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--op-muted-5);
}

.op-pw-card__more {
  display: inline-block;
  margin-top: 10px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--op-cta);
}

.op-kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.op-kpi-card {
  padding: 16px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-kpi-card__label {
  font-size: 11px;
  color: var(--op-muted-4);
}

.op-kpi-card__value {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 700;
  color: var(--op-ink);
  letter-spacing: -0.02em;
}

.op-meter {
  margin-top: 10px;
  height: 6px;
  border-radius: var(--op-radius-full);
  background: var(--op-line);
  overflow: hidden;
}

.op-meter span {
  display: block;
  height: 100%;
  background: var(--op-cta);
  border-radius: var(--op-radius-full);
}

.op-kpi-card__hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--op-muted-5);
}

.op-deck {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(300px, 0.9fr);
  gap: 16px;
  align-items: start;
}

.op-deck__main,
.op-deck__rail {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.op-board-wrap {
  padding: 16px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-board-wrap__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.op-board-wrap__head h2 {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-board-wrap__meta {
  font-size: 11px;
  color: var(--op-muted-5);
}

.op-rail-empty {
  padding: 20px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-rail-empty__body {
  margin-top: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--op-muted-3);
}

.op-rail-feed {
  padding: 16px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-rail-feed__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}

.op-rail-feed__head h3 {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--op-green);
  margin-top: 6px;
}

.op-rail-empty-state {
  padding: 20px 8px;
  text-align: center;
}

.op-rail-empty-state__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-rail-empty-state__body {
  margin-top: 6px;
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--op-muted-3);
}

@media (max-width: 1100px) {
  .op-deck {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .op-context-grid,
  .op-work-grid,
  .op-kpi-strip {
    grid-template-columns: 1fr;
  }
}
</style>
