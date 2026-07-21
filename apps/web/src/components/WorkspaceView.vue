<script setup lang="ts">
import { computed } from "vue";
import { useOffice } from "@/composables/useOffice";
import type { Project, ProjectStatus } from "@/types/office";
import { formatDateTime } from "@/utils/format";

const props = defineProps<{ project: Project }>();

const { employeeById } = useOffice();

const STATUS: Record<ProjectStatus, { label: string; cls: string }> = {
  ACTIVE: { label: "Ativo", cls: "badge--active" },
  PLANNED: { label: "Planejado", cls: "badge--planned" },
  PAUSED: { label: "Pausado", cls: "badge--paused" },
  COMPLETED: { label: "Concluído", cls: "badge--completed" },
};

const team = computed(() =>
  props.project.teamIds
    .map((id) => employeeById(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e)),
);

function authorName(id: string): string {
  const emp = employeeById(id);
  return emp ? `${emp.role} — ${emp.name}` : id;
}
</script>

<template>
  <div class="ws">
    <div class="ws__overview card">
      <div class="ws__head">
        <div>
          <h2 class="ws__name">{{ project.name }}</h2>
          <p class="ws__objective">{{ project.objective }}</p>
        </div>
        <span class="badge" :class="STATUS[project.status].cls">
          {{ STATUS[project.status].label }}
        </span>
      </div>

      <div class="ws__progress">
        <div class="ws__bar">
          <div class="ws__bar-fill" :style="{ width: `${project.progress}%` }" />
        </div>
        <span class="ws__pct">{{ project.progress }}% concluído</span>
      </div>

      <div class="ws__team">
        <span class="ws__label">Equipe envolvida</span>
        <div class="ws__members">
          <span v-for="member in team" :key="member.id" class="ws__member">
            {{ member.emoji }} {{ member.role }} — {{ member.name }}
          </span>
        </div>
      </div>
    </div>

    <div class="ws__decisions card">
      <span class="ws__label">Últimas decisões</span>
      <ul class="ws__dec-list">
        <li v-for="dec in project.decisions" :key="dec.id" class="ws__dec">
          <p class="ws__dec-text">{{ dec.summary }}</p>
          <span class="ws__dec-meta">
            {{ authorName(dec.authorId) }} • {{ formatDateTime(dec.date) }}
          </span>
        </li>
        <li v-if="project.decisions.length === 0" class="ws__dec-empty">
          Ainda não há decisões registradas.
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.ws {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 18px;
  align-items: start;
}

@media (max-width: 860px) {
  .ws {
    grid-template-columns: 1fr;
  }
}

.ws__overview,
.ws__decisions {
  padding: 22px;
}

.ws__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.ws__name {
  font-size: 22px;
}

.ws__objective {
  margin-top: 6px;
  font-size: 14px;
}

.ws__progress {
  display: flex;
  align-items: center;
  margin-top: 20px;
}

.ws__bar {
  flex: 1;
  height: 9px;
  background: var(--surface-2);
  border-radius: 999px;
  overflow: hidden;
  margin-right: 12px;
}

.ws__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand), #818cf8);
  border-radius: 999px;
}

.ws__pct {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
}

.ws__label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-soft);
  margin-bottom: 12px;
}

.ws__team {
  margin-top: 22px;
}

.ws__members {
  display: flex;
  flex-direction: column;
}

.ws__member {
  font-size: 13.5px;
  color: var(--text);
  padding: 7px 0;
  border-bottom: 1px solid var(--border);
}

.ws__member:last-child {
  border-bottom: none;
}

.ws__dec-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ws__dec {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.ws__dec:last-child {
  border-bottom: none;
}

.ws__dec-text {
  color: var(--text);
  font-size: 13.5px;
}

.ws__dec-meta {
  font-size: 11.5px;
  color: var(--text-soft);
}

.ws__dec-empty {
  color: var(--text-soft);
  font-size: 13px;
}
</style>
