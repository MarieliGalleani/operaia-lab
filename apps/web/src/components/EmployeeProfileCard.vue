<script setup lang="ts">
import { computed } from "vue";
import type { Employee, EmployeeStatus } from "@/types/office";

const props = defineProps<{
  employee: Employee;
  involvedProjects?: readonly string[];
}>();

const STATUS_CLASS: Record<EmployeeStatus, string> = {
  WORKING: "badge--working",
  AVAILABLE: "badge--available",
  HIRING: "badge--hiring",
};

const statusClass = computed(() => STATUS_CLASS[props.employee.status]);
const projects = computed(() => props.involvedProjects ?? []);
const CHIP_LIMIT = 4;
const visibleProjects = computed(() => projects.value.slice(0, CHIP_LIMIT));
const hiddenProjectsCount = computed(() =>
  Math.max(0, projects.value.length - CHIP_LIMIT),
);
</script>

<template>
  <article
    class="profile panel card-motion"
    :class="{ 'profile--hiring': !employee.active }"
  >
    <header class="profile__head">
      <span class="profile__avatar">{{ employee.emoji }}</span>
      <span class="badge badge--dot" :class="statusClass">
        {{ employee.statusLabel }}
      </span>
    </header>

    <div class="profile__id">
      <div class="profile__role">{{ employee.role }} — {{ employee.name }}</div>
      <div class="profile__specialty">{{ employee.specialtyLabel }}</div>
    </div>

    <p v-if="employee.mission" class="profile__mission">{{ employee.mission }}</p>
    <p v-else class="profile__mission profile__mission--empty">
      Atividade atual não disponível.
    </p>

    <div class="profile__section">
      <span class="profile__label">Projetos envolvidos</span>
      <div v-if="projects.length" class="profile__chips">
        <span v-for="name in visibleProjects" :key="name" class="profile__chip">
          {{ name }}
        </span>
        <span v-if="hiddenProjectsCount > 0" class="profile__chip profile__chip--more">
          +{{ hiddenProjectsCount }}
        </span>
      </div>
      <span v-else class="profile__none">Nenhum no momento</span>
    </div>

    <footer v-if="employee.lastActivity" class="profile__foot">
      <span class="profile__label">Última ação</span>
      <span class="profile__action">{{ employee.lastActivity }}</span>
    </footer>
  </article>
</template>

<style scoped>
.profile {
  padding: 18px;
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s var(--ease), transform 0.2s var(--ease), background 0.2s var(--ease);
}

.profile:hover {
  border-color: var(--brand-line);
  transform: translateY(-2px);
}

.profile--hiring {
  border-style: dashed;
  opacity: 0.85;
}

.profile__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.profile__avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.profile__role {
  font-weight: 600;
  font-size: var(--text-md);
  color: var(--text);
}

.profile__specialty {
  font-size: var(--text-xs);
  color: var(--text-soft);
  margin-top: 4px;
}

.profile__mission {
  font-size: var(--text-sm);
  margin-top: 12px;
  min-height: 40px;
  color: var(--text-muted);
  line-height: 1.5;
}

.profile__section {
  margin-top: 14px;
}

.profile__label {
  display: block;
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-soft);
  margin-bottom: 8px;
}

.profile__chips {
  display: flex;
  flex-wrap: wrap;
}

.profile__chip {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--brand);
  background: var(--brand-soft);
  border-radius: var(--radius-full);
  padding: 4px 10px;
  margin: 0 6px 6px 0;
}

.profile__chip--more {
  color: var(--text-soft);
  background: var(--surface-2);
}

.profile__none {
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.profile__foot {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.profile__action {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
