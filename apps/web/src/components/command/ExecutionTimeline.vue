<script setup lang="ts">
/**
 * Passo a Passo Compartilhado (Fase 4 — O Mural do Escritório).
 *
 * Mesma linguagem visual da esteira de etapas construída pro Marketing
 * (check verde quando pronto, indicador pulsando enquanto roda) — antes
 * esta tela usava um dot-timeline genérico, com tokens de um sistema de
 * design mais antigo (--border-strong, --surface). Mantém toda a
 * metadata que a execução real já carrega (responsável, duração,
 * resultado, erro, próximo passo).
 */
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

function iconClass(status: string): string {
  if (status === "ok") return "is-done";
  if (status === "running" || status === "waiting") return "is-running";
  if (status === "failed") return "is-failed";
  return "is-pending";
}
</script>

<template>
  <ol class="op-timeline" aria-label="Linha do tempo da execução">
    <li v-for="step in steps" :key="step.id" class="op-timeline__item">
      <span class="op-timeline__icon" :class="iconClass(step.status)">
        <template v-if="step.status === 'ok'">✓</template>
        <template v-else-if="step.status === 'failed'">✕</template>
        <template v-else-if="step.status === 'running' || step.status === 'waiting'">⋯</template>
        <template v-else>•</template>
      </span>

      <div class="op-timeline__body">
        <div class="op-timeline__row">
          <strong>{{ step.label }}</strong>
          <span class="op-timeline__badge" :class="iconClass(step.status)">
            {{ STATUS_LABEL[step.status] ?? step.status }}
          </span>
        </div>
        <p v-if="step.responsibleLabel" class="op-timeline__meta">Responsável: {{ step.responsibleLabel }}</p>
        <p v-if="step.durationMs != null" class="op-timeline__meta">
          Duração: {{ (step.durationMs / 1000).toFixed(1) }}s
        </p>
        <p v-if="step.resultSummary" class="op-timeline__meta">{{ step.resultSummary }}</p>
        <p v-if="step.error" class="op-timeline__error" role="alert">{{ step.error }}</p>
        <p v-if="step.nextStepLabel" class="op-timeline__meta">Próximo: {{ step.nextStepLabel }}</p>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.op-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.op-timeline__item {
  display: flex;
  gap: 12px;
  position: relative;
  padding-bottom: 20px;
}

.op-timeline__item:not(:last-child)::before {
  content: "";
  position: absolute;
  left: 11px;
  top: 26px;
  bottom: 0;
  width: 1px;
  background: var(--op-line-strong);
}

.op-timeline__icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: var(--op-track);
  color: var(--op-muted-3);
  z-index: 1;
}

.op-timeline__icon.is-done {
  background: var(--op-halo);
  color: var(--op-green);
}

.op-timeline__icon.is-running {
  color: var(--op-amber);
}

.op-timeline__icon.is-failed {
  color: var(--op-red);
  background: color-mix(in srgb, var(--op-red) 16%, transparent);
}

.op-timeline__body {
  flex: 1;
  min-width: 0;
  padding-top: 1px;
}

.op-timeline__row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--op-ink-2);
}

.op-timeline__badge {
  font-family: var(--op-font-mono);
  font-size: 10.5px;
  color: var(--op-muted-2);
  background: var(--op-raise);
  border: 1px solid var(--op-line);
  padding: 1px 7px;
  border-radius: var(--op-radius-full);
}

.op-timeline__badge.is-done {
  color: var(--op-green);
}

.op-timeline__badge.is-running {
  color: var(--op-amber);
}

.op-timeline__badge.is-failed {
  color: var(--op-red);
}

.op-timeline__meta {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--op-muted-3);
}

.op-timeline__error {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--op-red);
}
</style>
