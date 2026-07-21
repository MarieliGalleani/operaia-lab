<script setup lang="ts">
import { computed } from "vue";
import { useOffice } from "@/composables/useOffice";
import type { Task, TaskStatus } from "@/types/office";

const props = defineProps<{ tasks: readonly Task[] }>();

const { employeeById } = useOffice();

const COLUMNS: readonly { status: TaskStatus; label: string }[] = [
  { status: "BACKLOG", label: "Backlog" },
  { status: "IN_PROGRESS", label: "Em andamento" },
  { status: "DONE", label: "Concluído" },
];

const PRIORITY_CLASS: Record<Task["priority"], string> = {
  URGENT: "badge--paused",
  HIGH: "badge--planned",
  MEDIUM: "badge--hiring",
  LOW: "badge--hiring",
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
  <div class="board">
    <section v-for="column in COLUMNS" :key="column.status" class="board__col">
      <header class="board__col-head">
        <span>{{ column.label }}</span>
        <span class="board__count">{{ byStatus(column.status).length }}</span>
      </header>

      <div class="board__cards">
        <article
          v-for="task in byStatus(column.status)"
          :key="task.id"
          class="task card"
        >
          <p class="task__title">{{ task.title }}</p>
          <div class="task__meta">
            <span class="badge" :class="PRIORITY_CLASS[task.priority]">
              {{ task.priority }}
            </span>
            <span class="task__assignee">{{ assignee(task) }}</span>
          </div>
        </article>

        <p v-if="byStatus(column.status).length === 0" class="board__empty">
          Vazio
        </p>
      </div>
    </section>

    <p v-if="!hasTasks" class="board__none">Nenhuma tarefa neste projeto.</p>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 820px) {
  .board {
    grid-template-columns: 1fr;
  }
}

.board__col {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
}

.board__col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.board__count {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 11px;
  padding: 1px 8px;
  color: var(--text-soft);
}

.task {
  padding: 12px 14px;
  margin-bottom: 10px;
}

.task__title {
  color: var(--text);
  font-size: 13.5px;
  font-weight: 500;
}

.task__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.task__assignee {
  font-size: 11.5px;
  color: var(--text-soft);
}

.board__empty {
  font-size: 12px;
  color: var(--text-soft);
  text-align: center;
  padding: 8px 0;
}

.board__none {
  grid-column: 1 / -1;
  color: var(--text-soft);
  font-size: 13px;
}
</style>
