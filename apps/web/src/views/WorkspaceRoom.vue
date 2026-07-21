<script setup lang="ts">
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
  <div class="page">
    <router-link to="/office/projetos" class="back">← Projetos</router-link>

    <template v-if="project">
      <header class="ws-room">
        <h1 class="ws-room__name">🚀 {{ project.name }}</h1>
        <div class="ws-room__team">
          <span v-for="member in team" :key="member.id" class="ws-room__avatar">
            {{ member.emoji }}
          </span>
        </div>
      </header>

      <div class="section" style="margin-top: 6px">
        <WorkspaceView :project="project" />
      </div>

      <section v-if="workflow" class="section">
        <WorkflowViewer :workflow="workflow" />
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">Tarefas</h2>
        </div>
        <TaskBoard :tasks="projectTasks" />
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">Histórico do workspace</h2>
        </div>
        <div class="card" style="padding: 8px 20px">
          <ActivityStream :activities="projectActivities" />
        </div>
      </section>
    </template>

    <p v-else class="empty">Workspace não encontrado.</p>
  </div>
</template>

<style scoped>
.back {
  font-size: 13px;
  color: var(--brand);
  font-weight: 600;
}

.ws-room {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.ws-room__name {
  font-size: 24px;
}

.ws-room__team {
  display: flex;
}

.ws-room__avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-left: -8px;
  box-shadow: var(--shadow-sm);
}

.empty {
  margin-top: 24px;
  color: var(--text-soft);
}
</style>
