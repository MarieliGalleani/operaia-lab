<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import AutonomyBadge from "@/components/command/AutonomyBadge.vue";
import RiskBadge from "@/components/command/RiskBadge.vue";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { DecisionTraceDto, RiskLevel } from "@/data/office-command";

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));

const items = ref<readonly DecisionTraceDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const riskFilter = ref<"" | RiskLevel>("");

const filtered = computed(() =>
  riskFilter.value ? items.value.filter((d) => d.risk === riskFilter.value) : items.value,
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
  <OperationalHeader
    :floor="floor"
    :scope-line="`${floor.name} · dados isolados`"
    title="Decisões que precisam de você"
    lede="Apenas decisões registradas pelo escritório aparecem aqui. Aguardando não significa decisão humana."
    :show-cta="false"
    :refreshing="state === 'loading'"
    @refresh="loadDecisions"
  >
    <template #extra>
      <label class="op-filter">
        Risco
        <select v-model="riskFilter" class="op-select">
          <option value="">Todos</option>
          <option value="LOW">Baixo</option>
          <option value="MEDIUM">Médio</option>
          <option value="HIGH">Alto</option>
          <option value="CRITICAL">Crítico</option>
        </select>
      </label>
    </template>
  </OperationalHeader>
  <div class="op-content">
    <p v-if="state === 'loading'" class="op-loading">Carregando decisões…</p>
    <div v-else-if="state === 'error'" class="op-error" role="alert">
      <p class="op-error__title">Não foi possível carregar as decisões</p>
      <button type="button" class="op-btn-retry" @click="loadDecisions">Tentar de novo</button>
    </div>
    <template v-else>
      <p v-if="filtered.length === 0" class="op-empty-inline">
        Sem decisões neste filtro. Quando o escritório decidir, o racional auditável aparece aqui.
      </p>
      <div v-else class="op-decisions-list">
        <router-link
          v-for="d in filtered"
          :key="d.decisionId"
          :to="`/app/floor/dev/decisions/${d.decisionId}`"
          class="op-decision-card"
        >
          <p class="op-eyebrow-sm">Decisão</p>
          <h3 class="op-decision-card__title">{{ d.objective }}</h3>
          <p class="op-decision-card__why">{{ d.rationale }}</p>
          <div class="op-decision-card__badges">
            <RiskBadge :risk="d.risk" />
            <AutonomyBadge :autonomy="d.autonomy" />
          </div>
          <p class="op-decision-card__next">Próxima ação: {{ d.nextAction }}</p>
        </router-link>
      </div>
    </template>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
}

.op-loading,
.op-empty-inline {
  color: var(--op-muted-4);
  font-size: 13px;
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-error {
  max-width: 480px;
  padding: 24px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-error__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin-bottom: 10px;
}

.op-btn-retry {
  padding: 8px 14px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-raise);
  color: var(--op-ink-2);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.op-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--op-muted-3);
}

.op-select {
  padding: 7px 10px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-panel);
  color: var(--op-ink-3);
  font-family: "Sora", sans-serif;
  font-size: 12.5px;
}

.op-decisions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 680px;
}

.op-decision-card {
  display: block;
  padding: 16px 18px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.op-decision-card:hover {
  border-color: var(--op-line-strong);
  background: var(--op-raise);
}

.op-decision-card__title {
  margin-top: 6px;
  font-size: 15px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-decision-card__why {
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--op-muted-3);
}

.op-decision-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.op-decision-card__next {
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--op-muted-5);
}
</style>
