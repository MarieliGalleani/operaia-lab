<script setup lang="ts">
import { computed } from "vue";
import { useOffice } from "@/composables/useOffice";
import type { Task, TaskStatus } from "@/types/office";

const props = withDefaults(
  defineProps<{
    tasks: readonly Task[];
    /** Preenche a altura do container (workspace full-bleed). */
    fill?: boolean;
  }>(),
  { fill: false },
);

const { employeeById } = useOffice();

const COLUMNS: readonly { status: TaskStatus; label: string; hint: string }[] = [
  { status: "BACKLOG", label: "Backlog", hint: "Próximo a puxar" },
  { status: "IN_PROGRESS", label: "Em andamento", hint: "Em execução agora" },
  { status: "DONE", label: "Concluído", hint: "Entregue" },
];

const PRIORITY_CLASS: Record<Task["priority"], string> = {
  URGENT: "bad",
  HIGH: "warn",
  MEDIUM: "ok",
  LOW: "ok",
};

function byStatus(status: TaskStatus): readonly Task[] {
  return props.tasks.filter((task) => task.status === status);
}

function assignee(task: Task): string {
  const emp = task.assigneeId ? employeeById(task.assigneeId) : undefined;
  return emp ? `${emp.emoji} ${emp.name}` : "Sem responsável";
}

const hasTasks = computed(() => props.tasks.length > 0);
</script>

<template>
  <div class="op-board" :class="{ 'op-board--fill': fill }">
    <section
      v-for="column in COLUMNS"
      :key="column.status"
      class="op-board__col"
    >
      <header class="op-board__col-head">
        <div>
          <span class="op-board__col-label">{{ column.label }}</span>
          <p class="op-board__col-hint">{{ column.hint }}</p>
        </div>
        <span class="op-board__count">{{ byStatus(column.status).length }}</span>
      </header>

      <div class="op-board__cards">
        <article
          v-for="task in byStatus(column.status)"
          :key="task.id"
          class="op-task"
        >
          <p class="op-task__title">{{ task.title }}</p>
          <div class="op-task__meta">
            <span class="op-chip" :class="`op-chip--${PRIORITY_CLASS[task.priority]}`">
              {{ task.priority }}
            </span>
            <span class="op-task__assignee">{{ assignee(task) }}</span>
          </div>
        </article>

        <div v-if="byStatus(column.status).length === 0" class="op-board__empty">
          <p class="op-board__empty-title">Coluna livre</p>
          <p class="op-board__empty-body">{{ column.hint }}</p>
        </div>
      </div>
    </section>

    <p v-if="!hasTasks" class="op-board__none">Nenhuma tarefa neste projeto.</p>
  </div>
</template>

<style scoped>
.op-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.op-board--fill {
  flex: 1;
  min-height: 0;
  align-items: stretch;
}

.op-board--fill .op-board__col {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.op-board--fill .op-board__cards {
  flex: 1;
  min-height: 120px;
}

.op-board__col {
  padding: 12px;
  border-radius: var(--op-radius);
  border: 1px solid var(--op-line);
  background: var(--op-panel);
}

.op-board__col-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.op-board__col-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-board__col-hint {
  margin-top: 2px;
  font-size: 11px;
  color: var(--op-muted-4);
}

.op-board__count {
  background: var(--op-raise);
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-full);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  color: var(--op-muted-2);
}

.op-board__cards {
  display: flex;
  flex-direction: column;
}

.op-task {
  padding: 12px;
  margin-bottom: 8px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-line);
  background: var(--op-raise);
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.op-task:last-child {
  margin-bottom: 0;
}

.op-task:hover {
  border-color: var(--op-line-strong);
  transform: translateY(-1px);
}

.op-task__title {
  color: var(--op-ink-3);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
}

.op-task__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.op-task__assignee {
  font-size: 11px;
  color: var(--op-muted-4);
  margin-left: 8px;
  text-align: right;
}

.op-chip {
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 3px 7px;
  border-radius: var(--op-radius-xs);
}

.op-chip--bad {
  color: var(--op-red);
  background: rgba(248, 113, 113, 0.14);
}

.op-chip--warn {
  color: var(--op-amber);
  background: rgba(245, 158, 11, 0.14);
}

.op-chip--ok {
  color: var(--op-green);
  background: rgba(74, 222, 128, 0.14);
}

.op-board__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  padding: 16px 10px;
  border-radius: var(--op-radius-sm);
  border: 1px dashed var(--op-line-strong);
  text-align: center;
}

.op-board__empty-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--op-muted-2);
}

.op-board__empty-body {
  margin-top: 4px;
  font-size: 11px;
  color: var(--op-muted-4);
}

.op-board__none {
  grid-column: 1 / -1;
  color: var(--op-muted-4);
  font-size: 13px;
}

@media (max-width: 820px) {
  .op-board {
    grid-template-columns: 1fr;
  }
  .op-board--fill {
    min-height: auto;
  }
}
</style>
