<script setup lang="ts">
import type { ExecutionStepDto } from "@/data/office-command";

defineProps<{ steps: readonly ExecutionStepDto[] }>();

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  running: "Em execução",
  ok: "OK",
  failed: "Falhou",
  skipped: "Ignorado",
  waiting: "Aguardando",
};
</script>

<template>
  <ol class="timeline" aria-label="Linha do tempo da execução">
    <li
      v-for="step in steps"
      :key="step.id"
      class="timeline__item"
      :class="`timeline__item--${step.status}`"
    >
      <span class="timeline__dot" aria-hidden="true" />
      <div class="timeline__body">
        <div class="timeline__row">
          <strong>{{ step.label }}</strong>
          <span class="badge">{{ STATUS_LABEL[step.status] ?? step.status }}</span>
        </div>
        <p v-if="step.responsibleLabel" class="timeline__meta">
          Responsável: {{ step.responsibleLabel }}
        </p>
        <p v-if="step.durationMs != null" class="timeline__meta">
          Duração: {{ (step.durationMs / 1000).toFixed(1) }}s
        </p>
        <p v-if="step.resultSummary" class="timeline__meta">
          {{ step.resultSummary }}
        </p>
        <p v-if="step.error" class="timeline__err" role="alert">{{ step.error }}</p>
        <p v-if="step.nextStepLabel" class="timeline__meta">
          Próximo: {{ step.nextStepLabel }}
        </p>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}
.timeline__item {
  display: flex;
  position: relative;
  padding-bottom: 18px;
}
.timeline__item:not(:last-child)::before {
  content: "";
  position: absolute;
  left: 7px;
  top: 18px;
  bottom: 0;
  width: 2px;
  background: var(--border-strong);
}
.timeline__dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  background: var(--surface);
  margin-right: 14px;
  flex-shrink: 0;
  margin-top: 2px;
}
.timeline__item--ok .timeline__dot {
  border-color: var(--success);
  background: var(--success);
}
.timeline__item--running .timeline__dot,
.timeline__item--waiting .timeline__dot {
  border-color: var(--warning);
  background: var(--warning);
}
.timeline__item--failed .timeline__dot {
  border-color: var(--danger);
  background: var(--danger);
}
.timeline__body {
  flex: 1;
  min-width: 0;
}
.timeline__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.timeline__meta {
  margin-top: 4px;
  font-size: var(--text-sm);
}
.timeline__err {
  margin-top: 6px;
  color: var(--danger);
  font-size: var(--text-sm);
}
</style>
