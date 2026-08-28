<script setup lang="ts">
import AttentionCard from "@/components/command/AttentionCard.vue";
import DecisionCard from "@/components/command/DecisionCard.vue";
import WorkProgressCard from "@/components/command/WorkProgressCard.vue";
import { useOffice } from "@/composables/useOffice";
import type { CommandCenterDto } from "@/data/office-command";

defineProps<{ data: CommandCenterDto }>();

const { employeeById } = useOffice();

function personLabel(employeeId: string): string {
  const person = employeeById(employeeId);
  const name = person?.name ?? (employeeId === "operaia-ceo" ? "Opera" : employeeId);
  return person?.emoji ? `${person.emoji} ${name}` : name;
}

/**
 * Nunca escolhe "o" especialista quando há mais de um com entrega real —
 * mostra o nome só quando há exatamente 1, ou a contagem + todos os nomes
 * quando há mais. Sem dado nenhum, não mostra nada (não inventa).
 */
function deliveredByLabel(employeeIds: readonly string[]): string | null {
  if (employeeIds.length === 0) {
    return null;
  }
  if (employeeIds.length === 1) {
    return personLabel(employeeIds[0]!);
  }
  return `${employeeIds.length} especialistas envolvidos · ${employeeIds
    .map(personLabel)
    .join(" · ")}`;
}

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
          <div class="done__main">
            <router-link :to="item.href">{{ item.title }}</router-link>
            <span v-if="deliveredByLabel(item.deliveredByEmployeeIds)" class="done__owner">
              {{ deliveredByLabel(item.deliveredByEmployeeIds) }}
            </span>
          </div>
          <span class="done__when">{{ formatWhen(item.finishedAt) }}</span>
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
  align-items: flex-start;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: var(--text-sm);
}

.done__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.done__owner {
  margin-top: 4px;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.done__when {
  flex-shrink: 0;
  margin-left: 12px;
  color: var(--text-soft);
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
