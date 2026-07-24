<script setup lang="ts">
import { computed } from "vue";
import ActivityStream from "@/components/ActivityStream.vue";
import { useOffice } from "@/composables/useOffice";

const { activities, summary, employees, projects } = useOffice();

const byKind = computed(() => {
  const map = new Map<string, number>();
  for (const item of activities.value) {
    map.set(item.kind, (map.get(item.kind) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
});

const maxKind = computed(() => Math.max(1, ...byKind.value.map((r) => r.count)));
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker"><span class="live-dot" aria-hidden="true" />Pulso do lab</p>
        <h1 class="page__title">Central de atividades</h1>
      </div>

      <div class="studio__pulse" aria-label="Resumo">
        <span class="studio__pulse-item">
          <strong>{{ activities.length }}</strong> eventos
        </span>
        <span class="studio__pulse-item">
          <strong>{{ summary?.activeProjects ?? 0 }}</strong> projetos
        </span>
        <span class="studio__pulse-item">
          <strong>{{ summary?.workingEmployees ?? employees.filter((e) => e.active).length }}</strong> ativos
        </span>
      </div>

      <div class="topbar__right">
        <router-link to="/office/sala-ceo" class="btn btn--ghost">Sala da Opera</router-link>
        <router-link to="/office/projetos" class="btn btn--primary">Ver projetos</router-link>
      </div>
    </header>

    <div class="studio__stage">
      <section class="kpi-strip">
        <article class="kpi-card panel card-motion" style="--d: 1">
          <p class="kpi-card__label">Eventos</p>
          <p class="kpi-card__value">{{ activities.length }}</p>
          <p class="kpi-card__hint">no feed atual</p>
        </article>
        <article class="kpi-card panel card-motion" style="--d: 2">
          <p class="kpi-card__label">Projetos ativos</p>
          <p class="kpi-card__value">{{ summary?.activeProjects ?? 0 }}</p>
          <p class="kpi-card__hint">em andamento</p>
        </article>
        <article class="kpi-card panel card-motion" style="--d: 3">
          <p class="kpi-card__label">Equipe em operação</p>
          <p class="kpi-card__value">{{ summary?.workingEmployees ?? employees.filter((e) => e.active).length }}</p>
          <p class="kpi-card__hint">contratados ativos</p>
        </article>
        <article class="kpi-card panel card-motion" style="--d: 4">
          <p class="kpi-card__label">Workspaces</p>
          <p class="kpi-card__value">{{ projects.length }}</p>
          <p class="kpi-card__hint">no radar</p>
        </article>
      </section>

      <div class="board">
        <section class="board__main panel card-motion" style="--d: 5">
          <div class="section__head">
            <h2 class="section__title">Linha do tempo</h2>
            <span class="board__meta">ao vivo no lab</span>
          </div>
          <ActivityStream :activities="activities" />
          <div v-if="activities.length === 0" class="empty-state">
            <p class="empty-state__title">Silêncio no andar</p>
            <p class="empty-state__body">Quando a equipe agir, o feed enche aqui.</p>
          </div>
        </section>

        <aside class="board__side">
          <article class="panel side-card card-motion" style="--d: 6">
            <p class="eyebrow">Distribuição</p>
            <h3 class="section__title">Tipos em destaque</h3>
            <ul class="kinds">
              <li v-for="row in byKind" :key="row.kind" class="kinds__row">
                <div class="kinds__meta">
                  <span>{{ row.kind }}</span>
                  <strong>{{ row.count }}</strong>
                </div>
                <div class="meter">
                  <span :style="{ width: `${Math.round((row.count / maxKind) * 100)}%` }" />
                </div>
              </li>
            </ul>
            <p v-if="byKind.length === 0" class="side-card__empty">Sem eventos ainda.</p>
          </article>
          <article class="panel side-card side-card--cta card-motion" style="--d: 7">
            <p class="eyebrow">Continuar</p>
            <h3 class="section__title">No fluxo</h3>
            <p class="side-card__body">
              A Opera consolida decisões. Os projetos mostram o progresso. O Campus espera você.
            </p>
            <router-link to="/campus" class="btn btn--ghost">Abrir Campus</router-link>
            <router-link to="/office/vps" class="btn btn--primary side-card__btn">Painel VPS</router-link>
          </article>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topbar__left {
  min-width: 200px;
  margin-right: 16px;
}

.topbar__right {
  display: flex;
  margin-left: auto;
}

.topbar__right .btn + .btn {
  margin-left: 8px;
}

.board {
  display: flex;
  align-items: flex-start;
  margin-top: 8px;
}

.board__main {
  flex: 1.5;
  min-width: 0;
  padding: 16px 18px;
}

.board__meta {
  font-size: 11px;
  color: var(--text-soft);
}

.board__side {
  width: 300px;
  margin-left: 16px;
  flex-shrink: 0;
}

.side-card {
  padding: 16px;
}

.side-card + .side-card {
  margin-top: 14px;
}

.side-card .section__title {
  margin-top: 6px;
}

.side-card__body {
  margin-top: 8px;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--text-muted);
}

.side-card__btn {
  margin-top: 8px;
  width: 100%;
}

.side-card__empty {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-soft);
}

.kinds {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}

.kinds__row + .kinds__row {
  margin-top: 12px;
}

.kinds__meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.kinds__meta strong {
  color: var(--text);
}

@media (max-width: 960px) {
  .board {
    flex-direction: column;
  }
  .board__side {
    width: 100%;
    margin-left: 0;
    margin-top: 14px;
  }
  .studio__topbar {
    flex-wrap: wrap;
  }
  .topbar__right {
    width: 100%;
    margin-left: 0;
    margin-top: 12px;
  }
}
</style>
