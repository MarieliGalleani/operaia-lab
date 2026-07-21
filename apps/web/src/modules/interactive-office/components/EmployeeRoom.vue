<script setup lang="ts">
import { computed } from "vue";
import { useOffice } from "@/composables/useOffice";
import { TOOLS_BY_SPECIALIZATION } from "../config/office-config";
import { useInteractiveOffice } from "../composables/useInteractiveOffice";
import EmployeeProfile from "./EmployeeProfile.vue";

const props = defineProps<{ employeeId: string }>();

const { getEmployee, workspaces, openExecutive } = useInteractiveOffice();
const { employeeById, projects, tasks, activities } = useOffice();

const employee = computed(() => getEmployee(props.employeeId));
const canonical = computed(() => employeeById(props.employeeId));

const involvedProjects = computed(() =>
  workspaces.value.filter((ws) => ws.teamIds.includes(props.employeeId)),
);

const objectives = computed(() =>
  projects.value
    .filter((project) => project.teamIds.includes(props.employeeId))
    .map((project) => project.objective),
);

const myTasks = computed(() =>
  tasks.value.filter((task) => task.assigneeId === props.employeeId),
);

const tools = computed(() =>
  canonical.value ? TOOLS_BY_SPECIALIZATION[canonical.value.specialization] : [],
);

const agenda = computed<string[]>(() => {
  const items: string[] = [];
  if (employee.value?.state === "MEETING") {
    items.push("Reunião com a CEO — Opera (agora)");
  }
  for (const task of myTasks.value.filter((t) => t.status === "IN_PROGRESS")) {
    items.push(`Foco: ${task.title}`);
  }
  return items.length ? items : ["Sem compromissos no momento"];
});

const history = computed(() =>
  activities.value.filter((act) => act.actorId === props.employeeId).slice(0, 5),
);
const lastDecision = computed(() => history.value[0]?.message ?? "—");

const TASK_LABEL: Record<string, string> = {
  BACKLOG: "Backlog",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluído",
};
</script>

<template>
  <div v-if="employee" class="ws-emp">
    <button type="button" class="ws-emp__back" @click="openExecutive">
      ← Sala Executiva
    </button>

    <EmployeeProfile :employee-id="employeeId" />
    <p class="ws-emp__lead">Estação de trabalho</p>

    <section class="ws-emp__section">
      <span class="ws-emp__label">Missão</span>
      <p class="ws-emp__text">{{ employee.mission }}</p>
    </section>

    <section class="ws-emp__section">
      <span class="ws-emp__label">Objetivos</span>
      <ul v-if="objectives.length" class="ws-emp__list">
        <li v-for="(obj, i) in objectives" :key="i">{{ obj }}</li>
      </ul>
      <p v-else class="ws-emp__muted">Aguardando direção da CEO</p>
    </section>

    <section class="ws-emp__section">
      <span class="ws-emp__label">Projetos</span>
      <div v-if="involvedProjects.length" class="ws-emp__chips">
        <span v-for="ws in involvedProjects" :key="ws.id" class="ws-emp__chip">
          {{ ws.emoji }} {{ ws.name }}
        </span>
      </div>
      <p v-else class="ws-emp__muted">Nenhum no momento</p>
    </section>

    <section class="ws-emp__section">
      <span class="ws-emp__label">Agenda de hoje</span>
      <ul class="ws-emp__list">
        <li v-for="(item, i) in agenda" :key="i">{{ item }}</li>
      </ul>
    </section>

    <section class="ws-emp__section">
      <span class="ws-emp__label">Tarefas</span>
      <ul v-if="myTasks.length" class="ws-emp__tasks">
        <li v-for="task in myTasks" :key="task.id">
          <span class="ws-emp__task-status">{{ TASK_LABEL[task.status] }}</span>
          {{ task.title }}
        </li>
      </ul>
      <p v-else class="ws-emp__muted">Sem tarefas atribuídas</p>
    </section>

    <section class="ws-emp__section">
      <span class="ws-emp__label">Ferramentas</span>
      <div class="ws-emp__chips">
        <span v-for="tool in tools" :key="tool" class="ws-emp__tool">{{ tool }}</span>
      </div>
    </section>

    <section class="ws-emp__section">
      <span class="ws-emp__label">Última decisão</span>
      <p class="ws-emp__text">{{ lastDecision }}</p>
    </section>

    <section class="ws-emp__section">
      <span class="ws-emp__label">Histórico</span>
      <ul v-if="history.length" class="ws-emp__history">
        <li v-for="act in history" :key="act.id">{{ act.message }}</li>
      </ul>
      <p v-else class="ws-emp__muted">Sem histórico recente</p>
    </section>
  </div>
</template>

<style scoped>
.ws-emp {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
}

.ws-emp__back {
  align-self: flex-start;
  background: transparent;
  border: 0;
  color: #6366f1;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  padding: 0 0 8px;
}

.ws-emp__lead {
  margin: 10px 0 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

.ws-emp__section {
  margin-top: 14px;
}

.ws-emp__label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

.ws-emp__text {
  margin: 4px 0 0;
  font-size: 13px;
  color: #334155;
  line-height: 1.45;
}

.ws-emp__muted {
  margin: 4px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.ws-emp__list {
  margin: 4px 0 0;
  padding-left: 16px;
  font-size: 12px;
  color: #334155;
}

.ws-emp__list li {
  margin-top: 3px;
}

.ws-emp__chips {
  display: flex;
  flex-wrap: wrap;
  margin-top: 4px;
}

.ws-emp__chip,
.ws-emp__tool {
  margin: 3px 6px 0 0;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.ws-emp__chip {
  background: #f1f5f9;
  color: #475569;
}

.ws-emp__tool {
  background: #eef2ff;
  color: #4f46e5;
}

.ws-emp__tasks,
.ws-emp__history {
  margin: 4px 0 0;
  padding-left: 0;
  list-style: none;
}

.ws-emp__tasks li,
.ws-emp__history li {
  font-size: 12px;
  color: #334155;
  padding: 4px 0;
  border-top: 1px solid #f1f5f9;
}

.ws-emp__task-status {
  font-size: 10px;
  font-weight: 700;
  color: #6366f1;
  margin-right: 6px;
}
</style>
