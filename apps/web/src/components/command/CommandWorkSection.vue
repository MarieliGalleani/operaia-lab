<script setup lang="ts">
import AttentionCard from "@/components/command/AttentionCard.vue";
import DecisionCard from "@/components/command/DecisionCard.vue";
import WorkProgressCard from "@/components/command/WorkProgressCard.vue";
import type { CommandCenterDto } from "@/data/office-command";

defineProps<{ data: CommandCenterDto }>();

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
  <section v-if="data.attention.length" class="section" aria-labelledby="cc-attention">
    <div class="section__head">
      <div>
        <p class="eyebrow">Ação humana</p>
        <h2 id="cc-attention" class="section__title">Precisa de você</h2>
      </div>
      <router-link
        v-if="data.pendingApprovals > 0"
        to="/app/command/approvals"
        class="section__link"
      >
        Revisar aprovações
      </router-link>
    </div>
    <AttentionCard v-for="item in data.attention" :key="item.id" :item="item" />
  </section>

  <section class="section" aria-labelledby="cc-progress">
    <div class="section__head">
      <div>
        <p class="eyebrow">Trabalho do escritório</p>
        <h2 id="cc-progress" class="section__title">Em andamento</h2>
      </div>
      <router-link to="/app/missions" class="section__link">Ver missões</router-link>
    </div>
    <div v-if="data.inProgress.length" class="work-grid">
      <WorkProgressCard
        v-for="item in data.inProgress"
        :key="item.id"
        :item="item"
      />
    </div>
    <p v-else class="quiet">Você ainda não possui trabalhos em andamento.</p>
  </section>

  <div class="work-split">
    <section aria-labelledby="cc-decisions">
      <div class="section__head">
        <div>
          <p class="eyebrow">Contexto</p>
          <h2 id="cc-decisions" class="section__title">Decisões recentes</h2>
        </div>
        <router-link to="/app/decisions" class="section__link">Ver todas</router-link>
      </div>
      <DecisionCard
        v-for="item in data.decisions.slice(0, 4)"
        :key="item.id"
        :item="item"
      />
      <p v-if="!data.decisions.length" class="quiet">
        Nenhuma decisão requer acompanhamento agora.
      </p>
    </section>

    <section aria-labelledby="cc-done">
      <div class="section__head">
        <div>
          <p class="eyebrow">Resultado</p>
          <h2 id="cc-done" class="section__title">Concluído recentemente</h2>
        </div>
        <router-link to="/app/missions" class="section__link">Missões</router-link>
      </div>
      <ul v-if="data.completed.length" class="done">
        <li v-for="item in data.completed.slice(0, 6)" :key="item.id">
          <router-link :to="item.href">{{ item.title }}</router-link>
          <span>{{ formatWhen(item.finishedAt) }}</span>
        </li>
      </ul>
      <p v-else class="quiet">Ainda não há entregas recentes.</p>
    </section>
  </div>
</template>

<style scoped>
.work-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.work-grid > * {
  margin-right: 12px;
  margin-bottom: 12px;
}

.work-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: var(--space-3);
}

.work-split > section {
  margin-right: 16px;
}

.quiet {
  color: var(--text-soft);
  font-size: var(--text-sm);
}

.done {
  list-style: none;
  margin: 0;
  padding: 0;
}

.done li {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: var(--text-sm);
}

.done a:hover {
  color: var(--brand);
}

@media (max-width: 980px) {
  .work-grid,
  .work-split {
    grid-template-columns: 1fr;
  }

  .work-split > section {
    margin-right: 0;
    margin-bottom: 24px;
  }
}
</style>
