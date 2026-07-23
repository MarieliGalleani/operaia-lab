<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ActivityStream from "@/components/ActivityStream.vue";
import ExecutiveChat from "@/components/ExecutiveChat.vue";
import WorkflowViewer from "@/components/WorkflowViewer.vue";
import { useOffice } from "@/composables/useOffice";
import type { Workflow } from "@/types/office";

const { employees, projects, activities, summary, fetchWorkflow } = useOffice();

const ceo = computed(() =>
  employees.value.find(
    (employee) =>
      employee.specialization === "MANAGEMENT" && employee.active,
  ),
);

const featured = computed(
  () =>
    projects.value.find((project) => project.status === "ACTIVE") ??
    projects.value[0],
);

const workflow = ref<Workflow | undefined>(undefined);

async function refreshWorkflow(): Promise<void> {
  if (featured.value) {
    workflow.value = await fetchWorkflow(featured.value.id);
  }
}

onMounted(async () => {
  await refreshWorkflow();
});
</script>

<template>
  <div class="page room">
    <section v-if="ceo" class="ceo card">
      <div class="ceo__avatar">{{ ceo.emoji }}</div>
      <div class="ceo__id">
        <div class="ceo__name">{{ ceo.role }} — {{ ceo.name }}</div>
        <div class="ceo__title">{{ ceo.mission }}</div>
        <div class="ceo__meta">
          <span class="badge badge--dot badge--working">
            {{ ceo.statusLabel }}
          </span>
          <span class="ceo__last">Última atividade: {{ ceo.lastActivity }}</span>
        </div>
      </div>
    </section>

    <div class="room__grid">
      <div class="room__main">
        <div class="room__prompt">
          <h2 class="room__prompt-title">O que vamos fazer hoje?</h2>
          <p class="room__prompt-sub">
            Converse com a Opera sobre objetivos. Ela analisa, envolve os
            especialistas certos e devolve um relatório executivo.
          </p>
        </div>
        <ExecutiveChat :show-header="false" @replied="refreshWorkflow" />
      </div>

      <aside class="room__side">
        <div class="card room__panel">
          <span class="room__panel-label">No escritório agora</span>
          <ul class="pulse">
            <li class="pulse__item">
              <strong>{{ summary?.activeProjects ?? 0 }}</strong>
              <span>projetos ativos</span>
            </li>
            <li class="pulse__item">
              <strong>{{ summary?.workingEmployees ?? 0 }}</strong>
              <span>funcionários trabalhando</span>
            </li>
            <li class="pulse__item">
              <strong>{{ summary?.pendingTasks ?? 0 }}</strong>
              <span>tarefas pendentes</span>
            </li>
          </ul>
        </div>

        <WorkflowViewer v-if="workflow" :workflow="workflow" />

        <div class="card room__panel">
          <div class="room__panel-head">
            <span class="room__panel-label">Atividades recentes</span>
            <router-link to="/office/atividades" class="section__link">
              Ver tudo
            </router-link>
          </div>
          <ActivityStream :activities="activities" :limit="5" />
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.ceo {
  display: flex;
  align-items: center;
  padding: 24px 26px;
  margin-bottom: 22px;
  background: linear-gradient(120deg, var(--brand-soft), var(--surface));
}

.ceo__avatar {
  width: 76px;
  height: 76px;
  min-width: 76px;
  border-radius: 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  margin-right: 20px;
}

.ceo__name {
  font-size: 21px;
  font-weight: 700;
}

.ceo__title {
  font-size: 13.5px;
  color: var(--text-muted);
  margin-top: 4px;
  max-width: 640px;
}

.ceo__meta {
  display: flex;
  align-items: center;
  margin-top: 12px;
}

.ceo__last {
  font-size: 12.5px;
  color: var(--text-soft);
  margin-left: 14px;
}

.room__grid {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 22px;
  align-items: start;
}

@media (max-width: 980px) {
  .room__grid {
    grid-template-columns: 1fr;
  }
}

.room__prompt {
  margin-bottom: 14px;
}

.room__prompt-title {
  font-size: 20px;
}

.room__prompt-sub {
  font-size: 13.5px;
  color: var(--text-muted);
  margin-top: 4px;
}

.room__side {
  display: flex;
  flex-direction: column;
}

.room__side > * {
  margin-bottom: 18px;
}

.room__panel {
  padding: 18px 20px;
}

.room__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.room__panel-label {
  display: block;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-soft);
}

.pulse {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.pulse__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.pulse__item strong {
  font-size: 26px;
  color: var(--brand);
}

.pulse__item span {
  font-size: 11.5px;
  color: var(--text-soft);
  margin-top: 2px;
}
</style>
