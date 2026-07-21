<script setup lang="ts">
import { computed } from "vue";
import { useOffice } from "@/composables/useOffice";
import type { Project, ProjectStatus } from "@/types/office";

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
</script>

<template>
  <router-link :to="`/office/projetos/${project.id}`" class="project card">
    <header class="project__head">
      <h3 class="project__name">{{ project.name }}</h3>
      <span class="badge" :class="STATUS[project.status].cls">
        {{ STATUS[project.status].label }}
      </span>
    </header>

    <p class="project__objective">{{ project.objective }}</p>

    <div class="project__progress">
      <div class="project__bar">
        <div class="project__bar-fill" :style="{ width: `${project.progress}%` }" />
      </div>
      <span class="project__pct">{{ project.progress }}%</span>
    </div>

    <footer class="project__foot">
      <div class="project__team">
        <span
          v-for="member in team"
          :key="member.id"
          class="project__avatar"
          :title="`${member.role} — ${member.name}`"
        >
          {{ member.emoji }}
        </span>
      </div>
      <span class="project__open">Abrir workspace →</span>
    </footer>
  </router-link>
</template>

<style scoped>
.project {
  display: block;
  padding: 20px;
  transition: transform 0.15s, box-shadow 0.15s;
}

.project:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.project__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.project__name {
  font-size: 17px;
}

.project__objective {
  margin-top: 8px;
  font-size: 13px;
  min-height: 38px;
}

.project__progress {
  display: flex;
  align-items: center;
  margin-top: 14px;
}

.project__bar {
  flex: 1;
  height: 7px;
  background: var(--surface-2);
  border-radius: 999px;
  overflow: hidden;
  margin-right: 10px;
}

.project__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand), #818cf8);
  border-radius: 999px;
}

.project__pct {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.project__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}

.project__team {
  display: flex;
}

.project__avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--brand-soft);
  border: 2px solid var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  margin-right: -8px;
}

.project__open {
  font-size: 12.5px;
  color: var(--brand);
  font-weight: 600;
}
</style>
