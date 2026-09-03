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
  <div class="op-workflow">
    <header class="op-workflow__head">
      <div>
        <p class="op-eyebrow-sm">Fluxo de trabalho</p>
        <h3 class="op-workflow__title">{{ workflow.title }}</h3>
      </div>
    </header>

    <div class="op-workflow__rail">
      <div
        v-for="stage in STAGES"
        :key="stage.stage"
        class="op-stage"
        :class="`op-stage--${stageStatus(stage.stage)}`"
      >
        <span class="op-stage__dot" />
        <span class="op-stage__label">{{ stage.label }}</span>
      </div>
    </div>

    <ol class="op-chain">
      <li
        v-for="(step, index) in steps"
        :key="index"
        class="op-chain__step"
        :class="`op-chain__step--${step.status}`"
      >
        <span class="op-chain__avatar">{{ actorEmoji(step.actorId) }}</span>
        <div class="op-chain__body">
          <div class="op-chain__actor">{{ actorLabel(step.actorId) }}</div>
          <div class="op-chain__detail">{{ step.detail }}</div>
        </div>
        <span class="op-chain__status">
          {{ step.status === "done" ? "✓" : step.status === "current" ? "•••" : "" }}
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.op-workflow {
  padding: 20px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-workflow__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
}

.op-workflow__title {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-workflow__rail {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 4px 0 22px;
  border-bottom: 1px solid var(--op-line);
}

.op-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.op-stage:not(:last-child)::after {
  content: "";
  position: absolute;
  top: 6px;
  left: 50%;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, var(--op-line-strong), transparent);
}

.op-stage__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--op-line-strong);
  border: 2px solid var(--op-panel);
  z-index: 1;
  margin-bottom: 8px;
}

.op-stage__label {
  font-size: 10.5px;
  color: var(--op-muted-4);
  text-align: center;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.op-stage--done .op-stage__dot {
  background: var(--op-cta);
}
.op-stage--done .op-stage__label {
  color: var(--op-muted-2);
}
.op-stage--current .op-stage__dot {
  background: var(--op-cta);
  box-shadow: 0 0 0 4px var(--op-sel);
}
.op-stage--current .op-stage__label {
  color: var(--op-ink-2);
  font-weight: 700;
}

.op-chain {
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
}

.op-chain__step {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--op-radius-sm);
  margin-bottom: 8px;
  background: var(--op-raise);
  border: 1px solid var(--op-line);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.op-chain__step--current {
  border-color: var(--op-cta);
  background: var(--op-sel);
}

.op-chain__step--pending {
  opacity: 0.6;
}

.op-chain__avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--op-radius-sm);
  background: var(--op-panel);
  border: 1px solid var(--op-line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  margin-right: 12px;
}

.op-chain__body {
  flex: 1;
}

.op-chain__actor {
  font-size: 13px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-chain__detail {
  font-size: 12.5px;
  color: var(--op-muted-3);
  margin-top: 2px;
}

.op-chain__status {
  font-size: 13px;
  font-weight: 700;
  color: var(--op-cta);
  margin-left: 10px;
}
</style>
