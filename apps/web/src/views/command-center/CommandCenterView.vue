<script setup lang="ts">
import { computed } from "vue";
import AttentionCard from "@/components/command/AttentionCard.vue";
import WorkProgressCard from "@/components/command/WorkProgressCard.vue";
import DecisionCard from "@/components/command/DecisionCard.vue";
import EmptyState from "@/components/command/EmptyState.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { useCommandCenter } from "@/composables/useCommandCenter";
import type { OfficeLevel } from "@/data/office-command";

const { data, state, errorMessage, load } = useCommandCenter();

const levelMeta: Record<
  OfficeLevel,
  { chip: string; label: string }
> = {
  OPERATING: { chip: "chip--ok", label: "OPERANDO" },
  ATTENTION: { chip: "chip--warn", label: "ATENÇÃO" },
  PROBLEM: { chip: "chip--bad", label: "PROBLEMA" },
};

const meta = computed(() =>
  levelMeta[data.value?.status.level ?? "OPERATING"],
);

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia.";
  if (h < 18) return "Boa tarde.";
  return "Boa noite.";
});

const heroLine = computed(() => {
  const d = data.value;
  if (!d) return "";
  if (d.attention.length > 0) {
    return d.attention.length === 1
      ? "Há 1 item que precisa de você."
      : `Há ${d.attention.length} itens que precisam de você.`;
  }
  if (d.idle) return "Tudo em dia.";
  return d.status.summary;
});

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
</script>

<template>
  <div class="cc studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">
          <span class="live-dot" aria-hidden="true" />
          Command Center
        </p>
        <h1 class="page__title">Escritório</h1>
      </div>
      <div class="topbar__right">
        <router-link to="/app/command/new" class="btn btn--primary">
          Nova demanda
        </router-link>
        <button
          type="button"
          class="btn btn--ghost"
          :disabled="state === 'loading' && !data"
          @click="load"
        >
          Atualizar
        </button>
      </div>
    </header>

    <LoadingState v-if="state === 'loading' && !data" label="Carregando Command Center" />

    <div v-else-if="state === 'error' && !data" class="studio__stage" role="alert">
      <section class="panel">
        <p class="empty-state__title">Estado indisponível</p>
        <p>{{ errorMessage }}</p>
        <button type="button" class="btn btn--primary" @click="load">
          Tentar de novo
        </button>
      </section>
    </div>

    <div v-else-if="data" class="studio__stage">
      <p
        v-if="data.backendDependency || data.source !== 'api'"
        class="backend-note"
      >
        Fonte: {{ data.source }}
        <span v-if="data.backendDependency">
          · BACKEND DEPENDENCY P0.3C — Decision Trace / Approvals operacionais ainda
          parciais
        </span>
      </p>

      <section
        class="cc__hero panel"
        :class="`cc__hero--${data.status.level.toLowerCase()}`"
        aria-labelledby="cc-hero"
      >
        <p class="cc__greet">{{ greeting }}</p>
        <h2 id="cc-hero" class="cc__level">
          <span class="chip" :class="meta.chip" aria-hidden="true">●</span>
          {{ meta.label }}
        </h2>
        <p class="cc__line">{{ heroLine }}</p>
        <p class="cc__meta">Atualizado {{ formatWhen(data.generatedAt) }}</p>
        <div class="sr-only" aria-live="polite" aria-atomic="true">
          Estado: {{ meta.label }}. {{ heroLine }}.
          {{ data.pendingApprovals }} aprovações pendentes.
        </div>
      </section>

      <template v-if="data.idle && data.attention.length === 0">
        <EmptyState
          title="Seu escritório está em dia."
          :body="data.zeroMessage"
          cta-label="Nova demanda"
          cta-to="/app/command/new"
        />
      </template>

      <template v-else>
        <section
          v-if="data.attention.length"
          class="section"
          aria-labelledby="cc-attention"
        >
          <div class="section__head">
            <h2 id="cc-attention" class="section__title">Atenção</h2>
            <router-link
              v-if="data.pendingApprovals > 0"
              to="/app/command/approvals"
              class="section__link"
            >
              {{ data.pendingApprovals }} aprovação(ões)
            </router-link>
          </div>
          <AttentionCard
            v-for="item in data.attention"
            :key="item.id"
            :item="item"
          />
        </section>

        <section class="section" aria-labelledby="cc-progress">
          <div class="section__head">
            <h2 id="cc-progress" class="section__title">Em andamento</h2>
          </div>
          <div v-if="data.inProgress.length" class="cc__grid">
            <WorkProgressCard
              v-for="item in data.inProgress"
              :key="item.id"
              :item="item"
            />
          </div>
          <p v-else class="cc__quiet">Nada em andamento neste momento.</p>
        </section>

        <div class="cc__split">
          <section aria-labelledby="cc-decisions">
            <div class="section__head">
              <h2 id="cc-decisions" class="section__title">Decisões</h2>
              <router-link to="/app/decisions" class="section__link">Ver todas</router-link>
            </div>
            <DecisionCard
              v-for="item in data.decisions.slice(0, 4)"
              :key="item.id"
              :item="item"
            />
            <p v-if="!data.decisions.length" class="cc__quiet">
              Sem decisões recentes.
            </p>
          </section>

          <section aria-labelledby="cc-done">
            <div class="section__head">
              <h2 id="cc-done" class="section__title">Concluídos</h2>
              <router-link to="/app/missions" class="section__link">Missões</router-link>
            </div>
            <ul v-if="data.completed.length" class="cc__done">
              <li v-for="item in data.completed.slice(0, 6)" :key="item.id">
                <router-link :to="item.href">{{ item.title }}</router-link>
                <span>{{ formatWhen(item.finishedAt) }}</span>
              </li>
            </ul>
            <p v-else class="cc__quiet">Ainda não há entregas recentes.</p>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cc__hero {
  padding: 22px 24px;
  margin-bottom: var(--space-3);
}
.cc__hero--operating {
  border-color: rgba(52, 211, 153, 0.25);
}
.cc__hero--attention {
  border-color: rgba(251, 191, 36, 0.3);
}
.cc__hero--problem {
  border-color: rgba(248, 113, 113, 0.35);
}
.cc__greet {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.cc__level {
  margin-top: 8px;
  font-size: var(--text-2xl);
  display: flex;
  align-items: center;
}
.cc__level .chip {
  margin-right: 10px;
}
.cc__line {
  margin-top: 10px;
  font-size: var(--text-lg);
  color: var(--text);
}
.cc__meta {
  margin-top: 10px;
  font-size: var(--text-xs);
  color: var(--text-soft);
}
.cc__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.cc__grid > * {
  margin-right: 12px;
  margin-bottom: 12px;
}
.cc__split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: var(--space-3);
}
.cc__split > section {
  margin-right: 16px;
}
.cc__quiet {
  font-size: var(--text-sm);
  color: var(--text-soft);
}
.cc__done {
  list-style: none;
  margin: 0;
  padding: 0;
}
.cc__done li {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: var(--text-sm);
}
.cc__done a:hover {
  color: var(--brand);
}
.topbar__right .btn {
  margin-left: 8px;
}
@media (max-width: 980px) {
  .cc__grid,
  .cc__split {
    grid-template-columns: 1fr;
  }
  .cc__split > section {
    margin-right: 0;
    margin-bottom: 24px;
  }
}
@media (max-width: 768px) {
  .topbar__right {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  .topbar__right .btn {
    margin-left: 0;
    margin-top: 8px;
    width: 100%;
  }
}
</style>
