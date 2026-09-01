<script setup lang="ts">
/**
 * Workspace — tela crítica do lab.
 * Layout decision-first (ref. analytics Olayard): KPIs + deck + board que preenche a viewport.
 */
import { computed, onMounted, ref, watch } from "vue";
import ActivityStream from "@/components/ActivityStream.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import TaskBoard from "@/components/TaskBoard.vue";
import WorkflowViewer from "@/components/WorkflowViewer.vue";
import WorkspaceView from "@/components/WorkspaceView.vue";
import { useOffice } from "@/composables/useOffice";
import { createMissionsClient } from "@/data/adapters/missions-client";
import { officeCommandClient } from "@/data/adapters/office-client";
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
  <div class="ws-page" :class="{ 'ws-page--ready': Boolean(project) }">
    <header class="topbar">
      <div class="topbar__left">
        <router-link to="/app/workspaces" class="topbar__back">← Workspaces</router-link>
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
        <router-link
          v-if="project"
          :to="{ path: '/app/command/new', query: { workspace: project.id } }"
          class="btn btn--primary"
        >
          Nova demanda
        </router-link>
        <router-link to="/app/office/sala-ceo" class="btn btn--ghost">Com Opera</router-link>
      </div>
    </header>

    <template v-if="project">
      <section class="ws-context panel" aria-label="Contexto do workspace">
        <span
          class="badge"
          :class="
            officeContext?.kind === 'lab' ? 'badge--active' : 'badge--planned'
          "
        >
          {{
            officeContext?.kind === "lab"
              ? "OperaIA.lab"
              : "Cliente / Workspace"
          }}
        </span>
        <strong>{{ officeContext?.name ?? project.name }}</strong>
        <span class="ws-context__sep">·</span>
        <span>{{ officeContext?.statusLabel ?? `Status ${project.status}` }}</span>
        <span class="ws-context__sep">·</span>
        <router-link :to="{ path: '/app/command/new', query: { workspace: project.id } }">
          Nova demanda neste workspace
        </router-link>

        <LoadingState
          v-if="contextState === 'loading'"
          label="Carregando contexto Office"
        />
        <p
          v-else-if="contextState === 'error'"
          class="ws-context__error"
          role="alert"
        >
          {{ contextError }}
          <button
            type="button"
            class="btn btn--ghost"
            @click="loadOfficeContext(project.id, project.name)"
          >
            Tentar de novo
          </button>
        </p>
        <div
          v-else-if="contextState === 'ready' && officeContext"
          class="ws-context__office"
        >
          <p class="ws-context__counts" aria-label="Contagens oficiais">
            <span
              ><strong>{{ officeContext.automationsActive }}</strong> automações
              ativas</span
            >
            <span
              ><strong>{{ officeContext.missionsOpen }}</strong> missões
              abertas</span
            >
            <span
              ><strong>{{ officeContext.decisionsRecent }}</strong> decisões
              (7d)</span
            >
            <span
              ><strong>{{ officeContext.approvalsPending }}</strong> aprovações
              pendentes</span
            >
          </p>
          <p class="ws-context__hint">
            Credenciais: valores nunca exibidos — apenas status configurado.
          </p>
          <ul
            v-if="officeContext.integrations.length"
            class="ws-context__list"
            aria-label="Integrações"
          >
            <li
              v-for="item in officeContext.integrations"
              :key="item.id"
            >
              {{ item.label }}
              ·
              {{ item.configured ? "configurada" : "pendente" }}
            </li>
          </ul>
          <ul
            v-if="officeContext.credentials.length"
            class="ws-context__list"
            aria-label="Credenciais"
          >
            <li
              v-for="item in officeContext.credentials"
              :key="item.id"
            >
              {{ item.label }}
              ·
              {{ item.configured ? "configurada" : "pendente" }}
            </li>
          </ul>
          <p
            v-if="
              !officeContext.integrations.length &&
              !officeContext.credentials.length
            "
            class="ws-context__empty"
          >
            Nenhuma integração ou credencial registrada neste workspace.
          </p>
        </div>
      </section>

      <section class="project-context panel" aria-label="Contexto do projeto">
        <header class="project-context__head">
          <p class="eyebrow">Contexto</p>
          <h2>O que a OperaIA sabe sobre este projeto</h2>
        </header>
        <div class="project-context__grid">
          <article>
            <h3>Objetivo</h3>
            <p v-if="project.projectObjective">{{ project.projectObjective }}</p>
            <p v-else class="project-context__empty">
              Nenhum objetivo definido ainda.
            </p>
          </article>
          <article>
            <h3>Contexto</h3>
            <p v-if="project.projectContext">{{ project.projectContext }}</p>
            <p v-else class="project-context__empty">
              Nenhum contexto registrado ainda.
            </p>
          </article>
          <article>
            <h3>Restrições</h3>
            <p v-if="project.projectConstraints">{{ project.projectConstraints }}</p>
            <p v-else class="project-context__empty">
              Nenhuma restrição registrada ainda.
            </p>
          </article>
        </div>
      </section>

      <section class="project-work panel" aria-label="Trabalho do projeto">
        <header class="project-work__head">
          <p class="eyebrow">Trabalho</p>
          <h2>O que está acontecendo neste projeto</h2>
        </header>
        <LoadingState v-if="workState === 'loading'" label="Carregando trabalho do projeto" />
        <p v-else-if="workState === 'error'" class="project-work__error" role="alert">
          Não foi possível carregar o trabalho deste projeto agora.
        </p>
        <div v-else class="project-work__grid">
          <article class="pw-card">
            <header><h3>Demandas</h3></header>
            <p class="pw-card__unavailable">
              Ainda não é possível listar demandas por projeto — essa
              capacidade não existe hoje no backend (P1.13B).
            </p>
          </article>

          <article class="pw-card">
            <header>
              <h3>Missões</h3>
              <span class="pw-card__count">{{ projectMissions.length }}</span>
            </header>
            <ul v-if="projectMissions.length" class="pw-card__list">
              <li v-for="m in projectMissions.slice(0, 5)" :key="m.id">
                <router-link :to="`/app/floor/dev/missions/${m.id}`">
                  {{ m.objective.slice(0, 60) }}
                </router-link>
              </li>
            </ul>
            <p v-else class="pw-card__empty">Nenhuma missão neste projeto ainda.</p>
            <router-link to="/app/floor/dev/missions" class="pw-card__more">Ver todas as missões →</router-link>
          </article>

          <article class="pw-card">
            <header>
              <h3>Execuções</h3>
              <span class="pw-card__count">{{ projectExecutions.length }}</span>
            </header>
            <ul v-if="projectExecutions.length" class="pw-card__list">
              <li v-for="e in projectExecutions.slice(0, 5)" :key="e.id">
                <router-link :to="`/app/floor/dev/executions/${e.id}`">
                  {{ e.automationName }} · {{ e.status }}
                </router-link>
              </li>
            </ul>
            <p v-else class="pw-card__empty">Nenhuma execução neste projeto ainda.</p>
          </article>

          <article class="pw-card">
            <header>
              <h3>Decisões</h3>
              <span class="pw-card__count">{{ projectDecisions.length }}</span>
            </header>
            <ul v-if="projectDecisions.length" class="pw-card__list">
              <li v-for="d in projectDecisions.slice(0, 5)" :key="d.decisionId">
                <router-link :to="`/app/floor/dev/decisions/${d.decisionId}`">
                  {{ d.objective.slice(0, 60) }}
                </router-link>
              </li>
            </ul>
            <p v-else class="pw-card__empty">Nenhuma decisão neste projeto ainda.</p>
          </article>

          <article class="pw-card">
            <header>
              <h3>Aprovações</h3>
              <span class="pw-card__count">{{ projectApprovals.length }}</span>
            </header>
            <ul v-if="projectApprovals.length" class="pw-card__list">
              <li v-for="a in projectApprovals.slice(0, 5)" :key="a.id">
                <router-link :to="`/app/floor/dev/command/approvals/${a.id}`">
                  {{ a.title.slice(0, 60) }} · {{ a.status }}
                </router-link>
              </li>
            </ul>
            <p v-else class="pw-card__empty">Nenhuma aprovação neste projeto.</p>
          </article>

          <article class="pw-card">
            <header>
              <h3>Automações</h3>
              <span class="pw-card__count">{{ projectAutomations.length }}</span>
            </header>
            <ul v-if="projectAutomations.length" class="pw-card__list">
              <li v-for="a in projectAutomations.slice(0, 5)" :key="a.id">
                <router-link :to="`/app/floor/automation/automations/${a.id}`">
                  {{ a.name }}
                </router-link>
              </li>
            </ul>
            <p v-else class="pw-card__empty">Nenhuma automação neste projeto.</p>
          </article>
        </div>
      </section>

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
              <router-link to="/app/office/sala-ceo" class="btn btn--ghost">Abrir Sala da CEO</router-link>
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
                <router-link to="/app/office/atividades" class="btn btn--ghost">Ver atividades do lab</router-link>
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

.ws-context {
  margin: 12px 20px 0;
  padding: 12px 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.ws-context .badge {
  margin-right: 10px;
}
.ws-context__sep {
  margin: 0 8px;
  color: var(--text-soft);
}
.ws-context__error,
.ws-context__office,
.ws-context :deep(.loading) {
  flex-basis: 100%;
  margin-top: 10px;
}
.ws-context__error {
  color: var(--danger);
  font-size: var(--text-sm);
}
.ws-context__error .btn {
  margin-left: 8px;
}
.ws-context__counts {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.ws-context__counts span {
  margin-right: 16px;
  margin-bottom: 4px;
}
.ws-context__hint {
  margin: 8px 0 0;
  font-size: var(--text-xs);
  color: var(--text-soft);
}
.ws-context__list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.ws-context__list li {
  margin-bottom: 2px;
}
.ws-context__empty {
  margin: 8px 0 0;
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.topbar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  background:
    radial-gradient(ellipse at 0% 0%, rgba(59, 130, 246, 0.14), transparent 42%),
    radial-gradient(ellipse at 100% 0%, rgba(139, 92, 246, 0.09), transparent 36%),
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

.project-context,
.project-work {
  margin: 12px 20px 0;
  padding: 16px 18px;
}

.project-context__head h2 {
  margin-top: 4px;
  font-size: var(--text-lg);
  font-weight: 700;
}

.project-context__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-gap: 12px;
  margin-top: 14px;
}

.project-context__grid article {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.project-context__grid h3 {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-soft);
}

.project-context__grid p {
  margin-top: 8px;
  font-size: var(--text-sm);
  color: var(--text);
  white-space: pre-wrap;
}

.project-context__empty {
  color: var(--text-soft) !important;
  font-style: italic;
}

@media (max-width: 900px) {
  .project-context {
    margin: 12px 14px 0;
  }
  .project-context__grid {
    grid-template-columns: 1fr;
  }
}

.project-work__head h2 {
  margin-top: 4px;
  font-size: var(--text-lg);
  font-weight: 700;
}

.project-work__error {
  margin-top: 12px;
  font-size: var(--text-sm);
  color: var(--danger);
}

.project-work__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-gap: 12px;
  margin-top: 14px;
}

.pw-card {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.pw-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pw-card h3 {
  font-size: var(--text-sm);
  font-weight: 700;
}

.pw-card__count {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--brand);
  background: var(--brand-soft);
  border-radius: var(--radius-full);
  padding: 2px 8px;
}

.pw-card__list {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
}

.pw-card__list li {
  margin-bottom: 6px;
  font-size: var(--text-xs);
}

.pw-card__list a {
  color: var(--text);
}

.pw-card__list a:hover {
  color: var(--brand);
}

.pw-card__empty,
.pw-card__unavailable {
  margin-top: 10px;
  font-size: var(--text-xs);
  color: var(--text-soft);
}

.pw-card__more {
  display: inline-block;
  margin-top: 10px;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--brand);
}

@media (max-width: 900px) {
  .project-work {
    margin: 12px 14px 0;
  }
  .project-work__grid {
    grid-template-columns: 1fr;
  }
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
