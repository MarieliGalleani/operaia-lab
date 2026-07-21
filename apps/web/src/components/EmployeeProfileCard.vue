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
</script>

<template>
  <article
    class="profile card"
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

    <p class="profile__mission">{{ employee.mission }}</p>

    <div class="profile__section">
      <span class="profile__label">Projetos envolvidos</span>
      <div v-if="projects.length" class="profile__chips">
        <span v-for="name in projects" :key="name" class="profile__chip">
          {{ name }}
        </span>
      </div>
      <span v-else class="profile__none">Nenhum no momento</span>
    </div>

    <footer class="profile__foot">
      <span class="profile__label">Última ação</span>
      <span class="profile__action">{{ employee.lastActivity }}</span>
    </footer>
  </article>
</template>

<style scoped>
.profile {
  padding: 20px;
  display: flex;
  flex-direction: column;
  transition: transform 0.15s, box-shadow 0.15s;
}

.profile:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.profile--hiring {
  border-style: dashed;
  background: var(--surface-2);
}

.profile__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.profile__avatar {
  width: 54px;
  height: 54px;
  border-radius: 14px;
  background: var(--brand-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.profile__role {
  font-weight: 700;
  font-size: 15.5px;
}

.profile__specialty {
  font-size: 12.5px;
  color: var(--text-soft);
  margin-top: 2px;
}

.profile__mission {
  font-size: 13px;
  margin-top: 12px;
  min-height: 40px;
}

.profile__section {
  margin-top: 14px;
}

.profile__label {
  display: block;
  font-size: 11px;
  font-weight: 700;
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
  font-size: 12px;
  font-weight: 600;
  color: var(--brand);
  background: var(--brand-soft);
  border-radius: 999px;
  padding: 3px 10px;
  margin: 0 6px 6px 0;
}

.profile__none {
  font-size: 12.5px;
  color: var(--text-soft);
}

.profile__foot {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.profile__action {
  font-size: 12.5px;
  color: var(--text-muted);
}
</style>
