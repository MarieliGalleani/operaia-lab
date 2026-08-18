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
    <article class="ws__overview panel">
      <div class="ws__head">
        <div>
          <p class="eyebrow">Objetivo</p>
          <p class="ws__objective">{{ project.objective }}</p>
        </div>
        <span class="badge" :class="STATUS[project.status].cls">
          {{ STATUS[project.status].label }}
        </span>
      </div>

      <div class="ws__progress">
        <div class="meter">
          <span :style="{ width: `${project.progress}%` }" />
        </div>
        <span class="ws__pct">{{ project.progress }}%</span>
      </div>

      <div class="ws__team">
        <p class="eyebrow">Equipe envolvida</p>
        <div class="ws__members">
          <div v-for="member in team" :key="member.id" class="ws__member">
            <span class="ws__face">{{ member.emoji }}</span>
            <div>
              <strong>{{ member.role }} — {{ member.name }}</strong>
              <span>{{ member.statusLabel }}</span>
            </div>
          </div>
        </div>
      </div>
    </article>

    <article class="ws__decisions panel">
      <p class="eyebrow">Últimas decisões</p>
      <ul class="ws__dec-list">
        <li v-for="dec in project.decisions" :key="dec.id" class="ws__dec">
          <p class="ws__dec-text">{{ dec.summary }}</p>
          <span class="ws__dec-meta">
            {{ authorName(dec.authorId) }} · {{ formatDateTime(dec.date) }}
          </span>
        </li>
        <li v-if="project.decisions.length === 0" class="ws__dec-empty">
          <p class="ws__dec-empty__title">Nenhuma decisão ainda</p>
          <p class="ws__dec-empty__body">
            Use a Sala da CEO para registrar o próximo direcionamento deste workspace.
          </p>
          <router-link to="/app/office/sala-ceo" class="btn btn--ghost">Falar com a Opera</router-link>
        </li>
      </ul>
    </article>
  </div>
</template>

<style scoped>
.ws {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  grid-column-gap: 12px;
  align-items: stretch;
  flex-shrink: 0;
}

.ws__overview,
.ws__decisions {
  padding: 14px 16px;
  min-height: 0;
}

.ws__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.ws__objective {
  margin-top: 6px;
  font-size: 15px;
  color: var(--text);
  line-height: 1.45;
  max-width: 48ch;
  font-weight: 600;
}

.ws__progress {
  display: flex;
  align-items: center;
  margin-top: 14px;
}

.ws__progress .meter {
  flex: 1;
  margin-right: 10px;
  height: 6px;
}

.ws__pct {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
}

.ws__team {
  margin-top: 16px;
}

.ws__members {
  margin-top: 8px;
}

.ws__member {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.ws__member:last-child {
  border-bottom: none;
}

.ws__face {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  font-size: 14px;
  flex-shrink: 0;
}

.ws__member strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.ws__member span {
  display: block;
  font-size: 11px;
  color: var(--text-soft);
  margin-top: 2px;
}

.ws__dec-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}

.ws__dec {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.ws__dec:last-child {
  border-bottom: none;
}

.ws__dec-text {
  color: var(--text);
  font-size: 13px;
  line-height: 1.45;
}

.ws__dec-meta {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  color: var(--text-soft);
}

.ws__dec-empty {
  padding: 12px 0 4px;
}

.ws__dec-empty__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.ws__dec-empty__body {
  margin-top: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

@media (max-width: 860px) {
  .ws {
    grid-template-columns: 1fr;
    grid-row-gap: 12px;
  }
}
</style>
