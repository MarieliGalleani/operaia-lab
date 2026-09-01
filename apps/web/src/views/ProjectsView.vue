<script setup lang="ts">
import { computed } from "vue";
import ProjectCard from "@/components/ProjectCard.vue";
import { useOffice } from "@/composables/useOffice";

const { projects, summary } = useOffice();

const byStatus = computed(() => ({
  active: projects.value.filter((p) => p.status === "ACTIVE").length,
  planned: projects.value.filter((p) => p.status === "PLANNED").length,
  paused: projects.value.filter((p) => p.status === "PAUSED").length,
}));
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Clientes › Workspaces</p>
        <h1 class="page__title">Workspaces</h1>
      </div>

      <div class="studio__pulse" aria-label="Resumo dos workspaces">
        <span class="studio__pulse-item">
          <strong>{{ projects.length }}</strong> total
        </span>
        <span class="studio__pulse-item">
          <strong>{{ byStatus.active }}</strong> ativos
        </span>
        <span class="studio__pulse-item">
          <strong>{{ byStatus.planned }}</strong> planejados
        </span>
        <span class="studio__pulse-item">
          <strong>{{ byStatus.paused }}</strong> pausados
        </span>
      </div>

      <div class="topbar__right">
        <span class="hint">{{ summary?.pendingTasks ?? 0 }} tarefas abertas</span>
        <router-link to="/app/floor/dev/workspaces/new" class="btn btn--ghost">Novo projeto</router-link>
        <router-link to="/app/command/new" class="btn btn--primary">Nova demanda</router-link>
      </div>
    </header>

    <div class="studio__stage">
      <div v-if="projects.length" class="grid grid--cards">
        <ProjectCard
          v-for="(project, i) in projects"
          :key="project.id"
          :project="project"
          :style="{ '--d': i + 1 }"
        />
      </div>
      <div v-else class="empty-state">
        <p class="empty-state__title">Nenhum projeto no radar</p>
        <p class="empty-state__body">
          Quando a API listar workspaces, eles aparecem aqui com progresso e equipe.
        </p>
        <router-link to="/app/office/sala-ceo" class="btn btn--primary">Pedir missão à Opera</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topbar__left {
  min-width: 180px;
  margin-right: 20px;
}

.topbar__right {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.hint {
  margin-right: 14px;
  font-size: 12px;
  color: var(--text-soft);
}

.topbar__right .btn + .btn {
  margin-left: 8px;
}

@media (max-width: 900px) {
  .studio__topbar {
    flex-wrap: wrap;
  }
  .topbar__right {
    width: 100%;
    margin-left: 0;
    margin-top: 14px;
  }
}
</style>
