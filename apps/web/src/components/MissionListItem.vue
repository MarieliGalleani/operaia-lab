<script setup lang="ts">
import MissionStatusBadge from "@/components/MissionStatusBadge.vue";
import { useOffice } from "@/composables/useOffice";
import { cleanMissionObjective } from "@/data/mappers";
import { presentationFor } from "@/data/presentation";
import { formatDateTime } from "@/utils/format";
import type { MissionTreeNodeDTO } from "@/data/mission-contracts";
import type { Specialization } from "@/types/office";

const props = defineProps<{
  item: MissionTreeNodeDTO;
  index: number;
}>();

const { employeeById, projects } = useOffice();

function workspaceName(id: string): string {
  return projects.value.find((project) => project.id === id)?.name ?? id;
}

function ownerName(id: string): string {
  return employeeById(id)?.name ?? (id === "operaia-ceo" ? "Opera" : id);
}

function ownerEmoji(id: string): string {
  const person = employeeById(id);
  if (person) return person.emoji;
  return id === "operaia-ceo" ? presentationFor("MANAGEMENT").emoji : "👤";
}

function specialists(root: MissionTreeNodeDTO): readonly string[] {
  const people = new Map<string, string>();
  function walk(node: MissionTreeNodeDTO): void {
    if (node.missionKind === "EXECUTE") {
      const person = employeeById(node.ownerEmployeeId);
      const spec = node.requiredSpecialization as Specialization | null;
      const label = person?.name ?? node.ownerEmployeeId;
      const emoji = person?.emoji ?? (spec ? presentationFor(spec).emoji : "👤");
      people.set(node.ownerEmployeeId, `${emoji} ${label}`);
    }
    for (const child of node.children) walk(child);
  }
  walk(root);
  return [...people.values()];
}
</script>

<template>
  <router-link :to="`/app/missions/${props.item.id}`" class="op-mission-card">
    <header class="op-mission-card__head">
      <MissionStatusBadge :status="props.item.status" />
      <time class="op-mono">{{ formatDateTime(props.item.createdAt) }}</time>
    </header>
    <h2>{{ cleanMissionObjective(props.item.objective) }}</h2>
    <p class="op-mission-card__next">
      {{
        props.item.status === "COMPLETED"
          ? "Resultado disponível no detalhe"
          : props.item.status === "WAITING"
            ? "Aguardando próximo passo"
            : "O escritório está conduzindo este trabalho"
      }}
    </p>
    <dl class="op-mission-card__meta">
      <div>
        <dt>Responsável</dt>
        <dd>{{ ownerEmoji(props.item.ownerEmployeeId) }} {{ ownerName(props.item.ownerEmployeeId) }}</dd>
      </div>
      <div>
        <dt>Workspace</dt>
        <dd>{{ workspaceName(props.item.workspaceId) }}</dd>
      </div>
      <div>
        <dt>Especialista(s)</dt>
        <dd>{{ specialists(props.item).join(" · ") || "Ainda sem delegação" }}</dd>
      </div>
      <div>
        <dt>Resultado</dt>
        <dd>{{ props.item.status === "COMPLETED" ? "Disponível no detalhe" : "Ainda não" }}</dd>
      </div>
    </dl>
  </router-link>
</template>

<style scoped>
.op-mission-card {
  display: block;
  padding: 16px 18px;
  margin-bottom: 12px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.op-mission-card:hover {
  border-color: var(--op-line-strong);
  background: var(--op-hover);
}

.op-mission-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.op-mission-card__head time {
  font-size: 11px;
  color: var(--op-muted-4);
}

.op-mission-card h2 {
  margin: 10px 0 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--op-ink-2);
}

.op-mission-card__next {
  margin: 6px 0 0;
  color: var(--op-muted-2);
  font-size: 12.5px;
}

.op-mission-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
  margin-top: 14px;
}

.op-mission-card__meta dt {
  font-size: 10px;
  color: var(--op-muted-5);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.op-mission-card__meta dd {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: var(--op-muted-2);
}

@media (max-width: 900px) {
  .op-mission-card__meta {
    grid-template-columns: 1fr;
  }
}
</style>
