<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import DecisionCard from "@/components/command/DecisionCard.vue";
import EmptyState from "@/components/command/EmptyState.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { DecisionTraceDto, RiskLevel } from "@/data/office-command";

const items = ref<readonly DecisionTraceDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const riskFilter = ref<"" | RiskLevel>("");

const filtered = computed(() =>
  riskFilter.value
    ? items.value.filter((d) => d.risk === riskFilter.value)
    : items.value,
);

async function loadDecisions(): Promise<void> {
  state.value = "loading";
  try {
    items.value = await officeCommandClient.listDecisions();
    state.value = "ready";
  } catch (error) {
    console.log("[decisions] failed", error);
    state.value = "error";
  }
}

onMounted(loadDecisions);
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Equipe › Meu controle</p>
        <h1 class="page__title">Decisões que precisam de você</h1>
      </div>
      <label class="filter">
        Risco
        <select v-model="riskFilter">
          <option value="">Todos</option>
          <option value="LOW">Baixo</option>
          <option value="MEDIUM">Médio</option>
          <option value="HIGH">Alto</option>
          <option value="CRITICAL">Crítico</option>
        </select>
      </label>
    </header>
    <div class="studio__stage">
      <p class="backend-note" role="note">
        Apenas decisões registradas pelo escritório aparecem aqui. Aguardando não significa decisão humana.
      </p>
      <LoadingState v-if="state === 'loading'" />
      <section v-else-if="state === 'error'" class="panel decisions__error" role="alert">
        <p>Não foi possível carregar as decisões.</p>
        <button type="button" class="btn btn--primary" @click="loadDecisions">
          Tentar de novo
        </button>
      </section>
      <template v-else>
        <DecisionCard
          v-for="d in filtered"
          :key="d.decisionId"
          :item="{
            id: d.decisionId,
            title: d.objective,
            rationale: d.rationale,
            risk: d.risk,
            confidence: d.confidence,
            autonomy: d.autonomy,
            nextAction: d.nextAction,
            createdAt: d.createdAt,
            workspaceName: d.workspaceName,
          }"
        />
        <EmptyState
          v-if="!filtered.length"
          title="Sem decisões neste filtro"
          body="Quando o escritório decidir, o racional auditável aparece aqui."
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.filter {
  display: flex;
  align-items: center;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.filter select {
  margin-left: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.decisions__error {
  padding: 18px;
}
.decisions__error .btn {
  margin-top: 12px;
}
</style>
