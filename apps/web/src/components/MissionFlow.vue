<script setup lang="ts">
import { computed } from "vue";
import { useOffice } from "@/composables/useOffice";
import { presentationFor } from "@/data/presentation";
import type { MissionChildDTO } from "@/data/mission-contracts";
import type { Specialization } from "@/types/office";

const props = defineProps<{
  ownerEmployeeId: string;
  status: string;
  children: readonly MissionChildDTO[];
}>();

const { employeeById } = useOffice();

interface FlowStep {
  readonly key: string;
  readonly emoji: string;
  readonly label: string;
  readonly hint: string;
  readonly state: "done" | "current" | "idle";
}

function employeeLabel(id: string): { emoji: string; name: string } {
  const found = employeeById(id);
  if (found) {
    return { emoji: found.emoji, name: found.name };
  }
  if (id === "operaia-ceo") {
    return { emoji: presentationFor("MANAGEMENT").emoji, name: "Opera" };
  }
  if (id === "cto-mag") {
    return { emoji: presentationFor("SOFTWARE_ENGINEERING").emoji, name: "Mag" };
  }
  return { emoji: "👤", name: id };
}

function childState(status: string): "done" | "current" | "idle" {
  if (status === "COMPLETED") {
    return "done";
  }
  if (status === "FAILED") {
    return "done";
  }
  if (["CREATED", "QUEUED", "RUNNING", "WAITING"].includes(status)) {
    return "current";
  }
  return "idle";
}

const steps = computed<readonly FlowStep[]>(() => {
  const root = employeeLabel(props.ownerEmployeeId);
  const list: FlowStep[] = [
    {
      key: "root",
      emoji: root.emoji,
      label: root.name,
      hint: "Coordenação",
      state: props.children.length === 0 ? childState(props.status) : "done",
    },
  ];

  const executes = props.children.filter((child) => child.missionKind === "EXECUTE");
  for (const child of executes) {
    const person = employeeLabel(child.ownerEmployeeId);
    const spec = (child.requiredSpecialization ?? "SOFTWARE_ENGINEERING") as Specialization;
    list.push({
      key: child.id,
      emoji: person.emoji,
      label: person.name,
      hint: presentationFor(spec).specialtyLabel,
      state: childState(child.status),
    });
  }

  const hasDelivery = props.children.some((child) => child.missionKind === "EXECUTE");
  if (hasDelivery) {
    const executing = executes.some((child) =>
      ["CREATED", "QUEUED", "RUNNING", "WAITING"].includes(child.status),
    );
    list.push({
      key: "delivery",
      emoji: "📦",
      label: "Delivery",
      hint: "Entrega do especialista",
      state: executing ? "idle" : "done",
    });
  }

  const consolidate = props.children.find((child) => child.missionKind === "CONSOLIDATE");
  if (consolidate) {
    const opera = employeeLabel(consolidate.ownerEmployeeId);
    list.push({
      key: consolidate.id,
      emoji: opera.emoji,
      label: opera.name,
      hint: "Consolidação",
      state: childState(consolidate.status),
    });
  }

  list.push({
    key: "end",
    emoji: props.status === "FAILED" ? "⚠" : "✓",
    label: props.status === "FAILED" ? "Falhou" : "Concluído",
    hint: props.status,
    state:
      props.status === "COMPLETED" || props.status === "FAILED" ? "done" : "idle",
  });

  return list;
});
</script>

<template>
  <ol class="op-flow">
    <li
      v-for="step in steps"
      :key="step.key"
      class="op-flow__item"
      :class="`op-flow__item--${step.state}`"
    >
      <span class="op-flow__face">{{ step.emoji }}</span>
      <div class="op-flow__copy">
        <strong>{{ step.label }}</strong>
        <span>{{ step.hint }}</span>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.op-flow {
  list-style: none;
  margin: 0;
  padding: 0;
}

.op-flow__item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-line);
  background: var(--op-raise);
}

.op-flow__item:last-child {
  margin-bottom: 0;
}

.op-flow__item--current {
  border-color: var(--op-cta);
  background: var(--op-sel);
}

.op-flow__item--idle {
  opacity: 0.55;
}

.op-flow__face {
  width: 36px;
  height: 36px;
  border-radius: var(--op-radius-sm);
  background: var(--op-panel);
  border: 1px solid var(--op-line);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  font-size: 18px;
}

.op-flow__copy {
  display: flex;
  flex-direction: column;
}

.op-flow__copy strong {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-flow__copy span {
  margin-top: 2px;
  font-size: 11px;
  color: var(--op-muted-4);
}
</style>
