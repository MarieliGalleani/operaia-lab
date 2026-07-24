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
  <div class="workflow panel">
    <header class="workflow__head">
      <div>
        <p class="eyebrow">Fluxo de trabalho</p>
        <h3 class="workflow__title">{{ workflow.title }}</h3>
      </div>
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
  padding: 14px;
}

.workflow__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
}

.workflow__title {
  margin-top: 4px;
  font-size: 15px;
  font-family: var(--font-display);
  font-weight: 700;
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
  height: 1px;
  background: linear-gradient(90deg, var(--border-strong), transparent);
}

.stage__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--border-strong);
  border: 2px solid var(--surface);
  z-index: 1;
  margin-bottom: 8px;
}

.stage__label {
  font-size: 10.5px;
  color: var(--text-soft);
  text-align: center;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.stage--done .stage__dot {
  background: var(--brand);
}
.stage--done .stage__label {
  color: var(--text-muted);
}
.stage--current .stage__dot {
  background: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}
.stage--current .stage__label {
  color: var(--text);
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
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  transition: border-color 0.2s var(--ease), background 0.2s var(--ease);
}

.chain__step--current {
  border-color: var(--brand-line);
  background: var(--brand-soft);
}

.chain__step--pending {
  opacity: 0.6;
}

.chain__avatar {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: rgba(16, 24, 32, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
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
  margin-top: 2px;
}

.chain__status {
  font-size: 13px;
  font-weight: 700;
  color: var(--brand);
  margin-left: 10px;
}
</style>
