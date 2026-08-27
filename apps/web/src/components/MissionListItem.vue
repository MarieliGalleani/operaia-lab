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
  <router-link
    :to="`/app/missions/${props.item.id}`"
    class="card panel card-motion"
    :style="{ '--d': props.index + 1 }"
  >
    <header class="card__head">
      <MissionStatusBadge :status="props.item.status" />
      <time>{{ formatDateTime(props.item.createdAt) }}</time>
    </header>
    <h2>{{ cleanMissionObjective(props.item.objective) }}</h2>
    <p class="card__next">
      {{
        props.item.status === "COMPLETED"
          ? "Resultado disponível no detalhe"
          : props.item.status === "WAITING"
            ? "Aguardando próximo passo"
            : "O escritório está conduzindo este trabalho"
      }}
    </p>
    <dl class="meta">
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
.card {
  display: block;
  padding: 16px 18px;
  margin-bottom: 12px;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s var(--ease), transform 0.2s var(--ease);
}

.card:hover {
  border-color: var(--brand-line);
  transform: translateY(-1px);
}

.card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card__head time {
  font-size: var(--text-xs);
  color: var(--text-soft);
}

.card h2 {
  margin-top: 10px;
  font-size: var(--text-md);
  font-weight: 600;
  line-height: 1.4;
}

.card__next {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-column-gap: 12px;
  grid-row-gap: 10px;
  margin-top: 14px;
}

.meta dt {
  font-size: var(--text-xs);
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.meta dd {
  margin-top: 4px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

@media (max-width: 900px) {
  .meta {
    grid-template-columns: 1fr;
  }
}
</style>
