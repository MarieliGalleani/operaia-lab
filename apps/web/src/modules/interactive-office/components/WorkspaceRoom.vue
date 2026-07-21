<script setup lang="ts">
import { computed } from "vue";
import ActivityStream from "@/components/ActivityStream.vue";
import TaskBoard from "@/components/TaskBoard.vue";
import { useOffice } from "@/composables/useOffice";
import { useInteractiveOffice } from "../composables/useInteractiveOffice";

const props = defineProps<{ workspaceId: string }>();

const { workspaces, employees, openExecutive } = useInteractiveOffice();
const { projects, tasks, activities } = useOffice();

const workspace = computed(() =>
  workspaces.value.find((ws) => ws.id === props.workspaceId),
);
const project = computed(() =>
  projects.value.find((p) => p.id === props.workspaceId),
);

const team = computed(() =>
  employees.value.filter((e) => workspace.value?.teamIds.includes(e.id)),
);
const projectTasks = computed(() =>
  tasks.value.filter((task) => task.projectId === props.workspaceId),
);
const projectActivities = computed(() =>
  activities.value.filter((act) => act.projectId === props.workspaceId),
);

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  PLANNED: "Planejado",
  PAUSED: "Pausado",
  COMPLETED: "Concluído",
};
</script>

<template>
  <div v-if="workspace" class="ws">
    <button type="button" class="ws__back" @click="openExecutive">
      ← Sala Executiva
    </button>

    <header class="ws__head">
      <span class="ws__title">{{ workspace.emoji }} {{ workspace.name }}</span>
      <span class="ws__status">{{ STATUS_LABEL[workspace.status] ?? workspace.status }}</span>
    </header>

    <p class="ws__objective">{{ workspace.objective }}</p>

    <div class="ws__progress">
      <div class="ws__progress-bar" :style="{ width: `${workspace.progress}%` }" />
    </div>
    <span class="ws__progress-label">{{ workspace.progress }}% concluído</span>

    <section class="ws__section">
      <span class="ws__label">Equipe envolvida</span>
      <div class="ws__team">
        <span v-for="member in team" :key="member.id" class="ws__member">
          <span class="ws__member-emoji">{{ member.emoji }}</span>
          {{ member.role }} — {{ member.name }}
        </span>
      </div>
    </section>

    <section class="ws__section">
      <span class="ws__label">Tarefas</span>
      <TaskBoard :tasks="projectTasks" />
    </section>

    <section v-if="project && project.decisions.length" class="ws__section">
      <span class="ws__label">Decisões</span>
      <ul class="ws__decisions">
        <li v-for="decision in project.decisions" :key="decision.id">
          {{ decision.summary }}
        </li>
      </ul>
    </section>

    <section class="ws__section">
      <span class="ws__label">Histórico</span>
      <ActivityStream :activities="projectActivities" />
    </section>
  </div>
</template>

<style scoped>
.ws {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
}

.ws__back {
  align-self: flex-start;
  background: transparent;
  border: 0;
  color: #6366f1;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  padding: 0 0 8px;
}

.ws__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ws__title {
  font-size: 16px;
  font-weight: 800;
  color: #1e293b;
}

.ws__status {
  padding: 3px 9px;
  background: #ede9fe;
  color: #6d28d9;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.ws__objective {
  margin: 8px 0 0;
  font-size: 13px;
  color: #475569;
  line-height: 1.45;
}

.ws__progress {
  margin-top: 12px;
  height: 8px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.ws__progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #4f46e5);
  border-radius: 999px;
}

.ws__progress-label {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.ws__section {
  margin-top: 16px;
}

.ws__label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

.ws__team {
  display: flex;
  flex-direction: column;
  margin-top: 6px;
}

.ws__member {
  display: flex;
  align-items: center;
  padding: 5px 0;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.ws__member-emoji {
  margin-right: 7px;
}

.ws__decisions {
  margin: 6px 0 0;
  padding-left: 16px;
  font-size: 12px;
  color: #334155;
}

.ws__decisions li {
  margin-top: 4px;
}
</style>
