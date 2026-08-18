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
  <router-link :to="`/app/office/projetos/${project.id}`" class="project panel card-motion">
    <header class="project__head">
      <h3 class="project__name">{{ project.name }}</h3>
      <span class="badge" :class="STATUS[project.status].cls">
        {{ STATUS[project.status].label }}
      </span>
    </header>

    <p class="project__objective">{{ project.objective }}</p>

    <div class="project__progress">
      <div class="meter">
        <span :style="{ width: `${project.progress}%` }" />
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
      <span class="project__open">Abrir →</span>
    </footer>
  </router-link>
</template>

<style scoped>
.project {
  display: block;
  padding: 18px;
  transition: border-color 0.2s var(--ease), transform 0.2s var(--ease);
}

.project:hover {
  border-color: var(--brand-line);
  transform: translateY(-2px);
}

.project:hover .project__open {
  color: var(--info);
}

.project__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.project__name {
  font-size: var(--text-lg);
  font-weight: 600;
}

.project__objective {
  margin-top: 8px;
  font-size: var(--text-sm);
  min-height: 38px;
  color: var(--text-muted);
  line-height: 1.5;
}

.project__progress {
  display: flex;
  align-items: center;
  margin-top: 14px;
}

.project__progress .meter {
  flex: 1;
  margin-right: 10px;
}

.project__pct {
  font-size: var(--text-xs);
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
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 2px solid var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  margin-right: -8px;
}

.project__open {
  font-size: var(--text-xs);
  color: var(--brand);
  font-weight: 600;
}
</style>
