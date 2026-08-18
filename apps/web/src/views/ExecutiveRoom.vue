<script setup lang="ts">
/**
 * Studio executivo — se fosse meu produto:
 * a conversa é o trabalho; métricas e missão são periferia.
 */
import { computed, onMounted, ref } from "vue";
import ActivityStream from "@/components/ActivityStream.vue";
import ExecutiveChat from "@/components/ExecutiveChat.vue";
import WorkflowViewer from "@/components/WorkflowViewer.vue";
import { useOffice } from "@/composables/useOffice";
import type { Workflow } from "@/types/office";
import { greeting } from "@/utils/format";

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

const present = computed(() =>
  employees.value.filter((e) => e.active).slice(0, 5),
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
  <div class="studio">
    <header class="topbar">
      <div class="topbar__left">
        <p class="topbar__greet">{{ greeting() }}, Marieli</p>
        <h1 class="topbar__title">Sala da Opera</h1>
      </div>

      <div class="topbar__center">
        <div v-if="featured" class="focus">
          <span class="focus__label">Foco</span>
          <span class="focus__name">{{ featured.name }}</span>
        </div>
        <div class="pulse" aria-label="Status do escritório">
          <span class="pulse__item">
            <strong>{{ summary?.activeProjects ?? 0 }}</strong> projetos
          </span>
          <span class="pulse__item">
            <strong>{{ summary?.workingEmployees ?? 0 }}</strong> ativos
          </span>
          <span class="pulse__item">
            <strong>{{ summary?.pendingTasks ?? 0 }}</strong> tarefas
          </span>
        </div>
      </div>

      <div class="topbar__right">
        <div class="crew" aria-label="Equipe presente">
          <span
            v-for="person in present"
            :key="person.id"
            class="crew__face"
            :title="`${person.name} — ${person.statusLabel}`"
          >
            {{ person.emoji }}
          </span>
        </div>
        <router-link to="/app/campus" class="btn btn--ghost topbar__walk">Campus</router-link>
        <router-link to="/app/office" class="btn btn--ghost topbar__walk">Andar</router-link>
      </div>
    </header>

    <div class="stage">
      <section class="stage__main panel card-motion" style="--d: 1">
        <div v-if="ceo" class="host">
          <div class="host__avatar">{{ ceo.emoji }}</div>
          <div class="host__copy">
            <div class="host__row">
              <h2 class="host__name">{{ ceo.name }}</h2>
              <span class="badge badge--dot badge--working">{{ ceo.statusLabel }}</span>
            </div>
            <p class="host__role">{{ ceo.role }} · {{ ceo.mission }}</p>
          </div>
        </div>
        <ExecutiveChat :show-header="false" @replied="refreshWorkflow" />
      </section>

      <aside class="stage__rail">
        <div class="stage__rail-scroll">
          <div class="card-motion stage__workflow" style="--d: 2">
            <WorkflowViewer v-if="workflow" :workflow="workflow" />
          </div>
          <section class="rail-block panel card-motion" style="--d: 3">
            <div class="rail-block__head">
              <h3>Hoje no lab</h3>
              <router-link to="/app/office/atividades" class="section__link">Tudo</router-link>
            </div>
            <div class="rail-block__body">
              <ActivityStream :activities="activities" :limit="10" />
            </div>
          </section>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.studio {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  padding: 0;
  animation: rise-in 0.45s var(--ease) both;
}

.topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border);
  background:
    radial-gradient(ellipse at 0% 0%, rgba(59, 130, 246, 0.14), transparent 42%),
    radial-gradient(ellipse at 100% 0%, rgba(56, 189, 248, 0.06), transparent 36%),
    linear-gradient(180deg, #0c1424 0%, var(--bg) 100%);
}

.topbar__left {
  min-width: 180px;
  margin-right: 24px;
}

.topbar__greet {
  font-size: var(--text-xs);
  color: var(--text-soft);
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.topbar__title {
  margin-top: 4px;
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.topbar__center {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.focus {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 12px;
  background:
    linear-gradient(165deg, rgba(30, 48, 80, 0.4), transparent 50%),
    rgba(14, 21, 36, 0.72);
  border: 1px solid var(--border);
  margin-right: 16px;
}

.focus__label {
  font-size: var(--text-xs);
  color: var(--text-soft);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-right: 10px;
}

.focus__name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--brand);
}

.pulse {
  display: flex;
  align-items: center;
}

.pulse__item {
  display: inline-flex;
  align-items: baseline;
  margin-right: 10px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background:
    linear-gradient(165deg, rgba(30, 48, 80, 0.4), transparent 50%),
    rgba(14, 21, 36, 0.72);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.pulse__item strong {
  color: var(--text);
  font-weight: 700;
  margin-right: 6px;
  font-size: var(--text-lg);
}

.topbar__right {
  display: flex;
  align-items: center;
  margin-left: 16px;
}

.topbar__walk {
  margin-left: 10px;
  white-space: nowrap;
}

.crew {
  display: flex;
  align-items: center;
  margin-right: 12px;
}

.crew__face {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 2px solid var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  margin-left: -8px;
}

.crew__face:first-child {
  margin-left: 0;
}

.stage {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(300px, 0.9fr);
  min-height: 0;
  overflow: hidden;
}

.stage__main {
  display: flex;
  flex-direction: column;
  margin: 20px 12px 24px 28px;
  padding: 0;
  overflow: hidden;
  min-height: 0;
  height: auto;
}

.host {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.host__avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-right: 14px;
}

.host__row {
  display: flex;
  align-items: center;
}

.host__name {
  font-size: var(--text-lg);
  font-weight: 700;
  margin-right: 10px;
}

.host__role {
  margin-top: 4px;
  font-size: var(--text-sm);
  color: var(--text-muted);
  max-width: 52ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage__main :deep(.chat) {
  flex: 1;
  min-height: 0;
  height: auto;
  border: none;
  box-shadow: none;
  background: var(--surface);
  border-radius: 0;
}

.stage__main :deep(.chat__thread) {
  padding: 18px 20px;
  overflow-y: auto;
}

.stage__main :deep(.chat__suggestions),
.stage__main :deep(.chat__input) {
  flex-shrink: 0;
  padding-left: 20px;
  padding-right: 20px;
  padding-bottom: 16px;
}

.stage__rail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 20px 28px 24px 12px;
  border-left: 1px solid var(--border);
  background: var(--bg-elevated);
}

.stage__rail-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.stage__workflow {
  flex-shrink: 0;
  margin-bottom: 16px;
}

.rail-block {
  flex: 1;
  min-height: 0;
  padding: 16px;
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rail-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.rail-block__body {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.rail-block__head h3 {
  font-size: var(--text-sm);
  font-weight: 600;
}

@media (max-width: 980px) {
  .studio {
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .topbar {
    flex-wrap: wrap;
    padding: 16px;
  }

  .topbar__left,
  .topbar__center,
  .topbar__right {
    width: 100%;
    margin: 0 0 12px;
  }

  .topbar__right {
    justify-content: space-between;
  }

  .stage {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .stage__main {
    margin: 12px 16px;
    min-height: 70vh;
  }

  .stage__rail {
    border-left: none;
    border-top: 1px solid var(--border);
    padding: 16px;
    height: auto;
    overflow: visible;
  }

  .stage__rail-scroll {
    overflow: visible;
  }
}
</style>
