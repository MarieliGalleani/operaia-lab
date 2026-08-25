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

onMounted(async () => {
  try {
    items.value = await officeCommandClient.listDecisions();
    state.value = "ready";
  } catch (error) {
    console.log("[decisions] failed", error);
    state.value = "error";
  }
});
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Trabalho › Decisões</p>
        <h1 class="page__title">Decisões</h1>
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
      <p class="backend-note">
        Decision Trace auditável (sem chain-of-thought). BACKEND DEPENDENCY P0.3C.
      </p>
      <LoadingState v-if="state === 'loading'" />
      <p v-else-if="state === 'error'" role="alert">Falha ao carregar decisões.</p>
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
</style>
