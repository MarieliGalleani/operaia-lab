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
  URGENT: "chip--bad",
  HIGH: "chip--warn",
  MEDIUM: "chip--ok",
  LOW: "chip--ok",
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
  <div class="board" :class="{ 'board--fill': fill }">
    <section
      v-for="(column, i) in COLUMNS"
      :key="column.status"
      class="board__col"
      :style="{ '--d': i + 1 }"
    >
      <header class="board__col-head">
        <div>
          <span class="board__col-label">{{ column.label }}</span>
          <p class="board__col-hint">{{ column.hint }}</p>
        </div>
        <span class="board__count">{{ byStatus(column.status).length }}</span>
      </header>

      <div class="board__cards">
        <article
          v-for="task in byStatus(column.status)"
          :key="task.id"
          class="task"
        >
          <p class="task__title">{{ task.title }}</p>
          <div class="task__meta">
            <span class="chip" :class="PRIORITY_CLASS[task.priority]">
              {{ task.priority }}
            </span>
            <span class="task__assignee">{{ assignee(task) }}</span>
          </div>
        </article>

        <div v-if="byStatus(column.status).length === 0" class="board__empty">
          <p class="board__empty-title">Coluna livre</p>
          <p class="board__empty-body">{{ column.hint }}</p>
        </div>
      </div>
    </section>

    <p v-if="!hasTasks" class="board__none">Nenhuma tarefa neste projeto.</p>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-column-gap: 12px;
}

.board--fill {
  flex: 1;
  min-height: 0;
  align-items: stretch;
}

.board--fill .board__col {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.board--fill .board__cards {
  flex: 1;
  min-height: 120px;
}

.board__col {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background:
    var(--glass-sheen), var(--glass);
}

.board__col-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.board__col-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.board__col-hint {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-soft);
}

.board__count {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  color: var(--text-muted);
}

.board__cards {
  display: flex;
  flex-direction: column;
}

.task {
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background:
    linear-gradient(165deg, rgba(30, 48, 80, 0.35), transparent 50%),
    var(--surface);
  transition: border-color 0.2s var(--ease), transform 0.2s var(--ease);
}

.task:last-child {
  margin-bottom: 0;
}

.task:hover {
  border-color: var(--brand-line);
  transform: translateY(-1px);
}

.task__title {
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
}

.task__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.task__assignee {
  font-size: 11px;
  color: var(--text-soft);
  margin-left: 8px;
  text-align: right;
}

.board__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  padding: 16px 10px;
  border-radius: 10px;
  border: 1px dashed var(--border-strong);
  text-align: center;
}

.board__empty-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.board__empty-body {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-soft);
}

.board__none {
  grid-column: 1 / -1;
  color: var(--text-soft);
  font-size: 13px;
}

@media (max-width: 820px) {
  .board {
    grid-template-columns: 1fr;
    grid-row-gap: 12px;
  }
  .board--fill {
    min-height: auto;
  }
}
</style>
