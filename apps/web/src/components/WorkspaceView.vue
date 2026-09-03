<script setup lang="ts">
import { computed } from "vue";
import { useOffice } from "@/composables/useOffice";
import type { Project, ProjectStatus } from "@/types/office";
import { formatDateTime } from "@/utils/format";

const props = defineProps<{ project: Project }>();

const { employeeById } = useOffice();

const STATUS: Record<ProjectStatus, { label: string; cls: string }> = {
  ACTIVE: { label: "Ativo", cls: "active" },
  PLANNED: { label: "Planejado", cls: "planned" },
  PAUSED: { label: "Pausado", cls: "paused" },
  COMPLETED: { label: "Concluído", cls: "completed" },
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
  <div class="op-ws">
    <article class="op-ws__overview">
      <div class="op-ws__head">
        <div>
          <p class="op-eyebrow-sm">Objetivo</p>
          <p class="op-ws__objective">{{ project.objective }}</p>
        </div>
        <span class="op-status-chip" :class="`op-status-chip--${STATUS[project.status].cls}`">
          {{ STATUS[project.status].label }}
        </span>
      </div>

      <div class="op-ws__progress">
        <div class="op-meter">
          <span :style="{ width: `${project.progress}%` }" />
        </div>
        <span class="op-ws__pct">{{ project.progress }}%</span>
      </div>

      <div class="op-ws__team">
        <p class="op-eyebrow-sm">Equipe envolvida</p>
        <div class="op-ws__members">
          <div v-for="member in team" :key="member.id" class="op-ws__member">
            <span class="op-ws__face">{{ member.emoji }}</span>
            <div>
              <strong>{{ member.role }} — {{ member.name }}</strong>
              <span>{{ member.statusLabel }}</span>
            </div>
          </div>
        </div>
      </div>
    </article>

    <article class="op-ws__decisions">
      <p class="op-eyebrow-sm">Últimas decisões</p>
      <ul class="op-ws__dec-list">
        <li v-for="dec in project.decisions" :key="dec.id" class="op-ws__dec">
          <p class="op-ws__dec-text">{{ dec.summary }}</p>
          <span class="op-ws__dec-meta">
            {{ authorName(dec.authorId) }} · {{ formatDateTime(dec.date) }}
          </span>
        </li>
        <li v-if="project.decisions.length === 0" class="op-ws__dec-empty">
          <p class="op-ws__dec-empty__title">Nenhuma decisão ainda</p>
          <p class="op-ws__dec-empty__body">
            Use a Sala da CEO para registrar o próximo direcionamento deste workspace.
          </p>
          <router-link to="/app/office/sala-ceo" class="op-btn">Falar com a Opera</router-link>
        </li>
      </ul>
    </article>
  </div>
</template>

<style scoped>
.op-ws {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 12px;
  align-items: stretch;
  flex-shrink: 0;
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-ws__overview,
.op-ws__decisions {
  padding: 18px 20px;
  min-height: 0;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-ws__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.op-ws__objective {
  margin-top: 6px;
  font-size: 15px;
  color: var(--op-ink);
  line-height: 1.45;
  max-width: 48ch;
  font-weight: 600;
}

.op-status-chip {
  flex-shrink: 0;
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: var(--op-radius-xs);
  background: var(--op-raise);
  color: var(--op-muted-2);
}

.op-status-chip--active {
  color: var(--op-green);
}

.op-ws__progress {
  display: flex;
  align-items: center;
  margin-top: 14px;
  gap: 10px;
}

.op-meter {
  flex: 1;
  height: 6px;
  border-radius: var(--op-radius-full);
  background: var(--op-line);
  overflow: hidden;
}

.op-meter span {
  display: block;
  height: 100%;
  background: var(--op-cta);
  border-radius: var(--op-radius-full);
}

.op-ws__pct {
  font-size: 12px;
  font-weight: 700;
  color: var(--op-muted-2);
}

.op-ws__team {
  margin-top: 16px;
}

.op-ws__members {
  margin-top: 8px;
}

.op-ws__member {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--op-line);
}

.op-ws__member:last-child {
  border-bottom: none;
}

.op-ws__face {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--op-raise);
  border: 1px solid var(--op-line);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  font-size: 14px;
  flex-shrink: 0;
}

.op-ws__member strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-ws__member span {
  display: block;
  font-size: 11px;
  color: var(--op-muted-4);
  margin-top: 2px;
}

.op-ws__dec-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}

.op-ws__dec {
  padding: 10px 0;
  border-bottom: 1px solid var(--op-line);
}

.op-ws__dec:last-child {
  border-bottom: none;
}

.op-ws__dec-text {
  color: var(--op-ink-3);
  font-size: 13px;
  line-height: 1.45;
}

.op-ws__dec-meta {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  color: var(--op-muted-4);
}

.op-ws__dec-empty {
  padding: 12px 0 4px;
}

.op-ws__dec-empty__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-ws__dec-empty__body {
  margin-top: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--op-muted-3);
  line-height: 1.4;
}

.op-btn {
  padding: 9px 15px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  background: transparent;
  color: var(--op-muted);
  font-family: "Sora", sans-serif;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.op-btn:hover {
  border-color: var(--op-bd-btn-h);
  color: var(--op-ink-3);
  background: var(--op-raise);
}

@media (max-width: 860px) {
  .op-ws {
    grid-template-columns: 1fr;
  }
}
</style>
