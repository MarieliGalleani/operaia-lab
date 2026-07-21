<script setup lang="ts">
import { computed } from "vue";
import { useOffice } from "@/composables/useOffice";
import type {
  Workflow,
  WorkflowStage,
  WorkflowStepStatus,
} from "@/types/office";

const props = defineProps<{ workflow: Workflow }>();

const { employeeById } = useOffice();

const STAGES: readonly { stage: WorkflowStage; label: string }[] = [
  { stage: "THINKING", label: "Pensando" },
  { stage: "ANALYZING", label: "Analisando" },
  { stage: "DELEGATING", label: "Delegando" },
  { stage: "EXECUTING", label: "Executando" },
  { stage: "REVIEWING", label: "Revisando" },
  { stage: "DONE", label: "Concluído" },
];

function stageStatus(stage: WorkflowStage): WorkflowStepStatus | "idle" {
  const step = props.workflow.steps.find((item) => item.stage === stage);
  return step ? step.status : "idle";
}

function actorLabel(actorId: string): string {
  const employee = employeeById(actorId);
  return employee ? `${employee.role} — ${employee.name}` : actorId;
}

function actorEmoji(actorId: string): string {
  return employeeById(actorId)?.emoji ?? "•";
}

const steps = computed(() => props.workflow.steps);
</script>

<template>
  <div class="workflow card">
    <header class="workflow__head">
      <h3 class="workflow__title">{{ workflow.title }}</h3>
      <span class="workflow__hint">Fluxo de trabalho</span>
    </header>

    <div class="workflow__rail">
      <div
        v-for="stage in STAGES"
        :key="stage.stage"
        class="stage"
        :class="`stage--${stageStatus(stage.stage)}`"
      >
        <span class="stage__dot" />
        <span class="stage__label">{{ stage.label }}</span>
      </div>
    </div>

    <ol class="chain">
      <li
        v-for="(step, index) in steps"
        :key="index"
        class="chain__step"
        :class="`chain__step--${step.status}`"
      >
        <span class="chain__avatar">{{ actorEmoji(step.actorId) }}</span>
        <div class="chain__body">
          <div class="chain__actor">{{ actorLabel(step.actorId) }}</div>
          <div class="chain__detail">{{ step.detail }}</div>
        </div>
        <span class="chain__status">
          {{ step.status === "done" ? "✓" : step.status === "current" ? "•••" : "" }}
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.workflow {
  padding: 20px 22px;
}

.workflow__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 18px;
}

.workflow__title {
  font-size: 16px;
}

.workflow__hint {
  font-size: 11.5px;
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.workflow__rail {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 4px 0 22px;
  border-bottom: 1px solid var(--border);
}

.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.stage:not(:last-child)::after {
  content: "";
  position: absolute;
  top: 6px;
  left: 50%;
  width: 100%;
  height: 2px;
  background: var(--border);
}

.stage__dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--border);
  border: 2px solid var(--surface);
  z-index: 1;
  margin-bottom: 8px;
}

.stage__label {
  font-size: 11.5px;
  color: var(--text-soft);
  text-align: center;
}

.stage--done .stage__dot {
  background: var(--success);
}
.stage--done .stage__label {
  color: var(--text-muted);
}
.stage--current .stage__dot {
  background: var(--brand);
  box-shadow: 0 0 0 4px var(--brand-soft);
}
.stage--current .stage__label {
  color: var(--brand);
  font-weight: 700;
}

.chain {
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
}

.chain__step {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.chain__step--current {
  border-color: var(--brand);
  background: var(--brand-soft);
}

.chain__step--pending {
  opacity: 0.65;
}

.chain__avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  margin-right: 12px;
}

.chain__body {
  flex: 1;
}

.chain__actor {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.chain__detail {
  font-size: 12.5px;
  color: var(--text-muted);
}

.chain__status {
  font-size: 13px;
  font-weight: 700;
  color: var(--brand);
  margin-left: 10px;
}
</style>
