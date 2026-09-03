<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import AutonomyBadge from "@/components/command/AutonomyBadge.vue";
import RiskBadge from "@/components/command/RiskBadge.vue";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { DecisionTraceDto } from "@/data/office-command";

const props = defineProps<{ id: string }>();
const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
const id = props.id || String(route.params.id);

const detail = ref<DecisionTraceDto | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");

onMounted(async () => {
  try {
    detail.value = await officeCommandClient.getDecision(id);
    state.value = detail.value ? "ready" : "error";
  } catch (error) {
    console.log("[decision-detail] failed", error);
    state.value = "error";
  }
});
</script>

<template>
  <OperationalHeader
    :floor="floor"
    scope-line="Decisões · Detalhe"
    title="Decision trace"
    lede="O racional auditável por trás desta decisão do escritório."
    :show-cta="false"
    :show-refresh="false"
  >
    <template #extra>
      <router-link to="/app/floor/dev/decisions" class="op-btn">Voltar</router-link>
    </template>
  </OperationalHeader>
  <div class="op-content">
    <p v-if="state === 'loading'" class="op-loading">Carregando decisão…</p>
    <p v-else-if="state === 'error'" class="op-error" role="alert">Decisão não encontrada.</p>
    <section v-else-if="detail" class="op-det">
      <div class="op-det__ctx">
        <span class="op-status-chip">Cliente</span>
        <strong class="op-det__ctx-name">{{ detail.workspaceName }}</strong>
      </div>
      <h2 class="op-det__title">{{ detail.objective }}</h2>
      <dl class="op-det__dl">
        <div>
          <dt>Contexto</dt>
          <dd>{{ detail.context }}</dd>
        </div>
        <div>
          <dt>Opções</dt>
          <dd>
            <ul class="op-det__list">
              <li
                v-for="opt in detail.options"
                :key="opt.id"
                :class="{ 'op-det--chosen': opt.id === detail.chosenOptionId }"
              >
                {{ opt.id }} — {{ opt.label }}
                <span v-if="opt.id === detail.chosenOptionId"> (escolhida)</span>
              </li>
            </ul>
          </dd>
        </div>
        <div>
          <dt>Por quê</dt>
          <dd>{{ detail.rationale }}</dd>
        </div>
        <div>
          <dt>Risco / Confiança / Autonomia</dt>
          <dd class="op-det__badges">
            <RiskBadge :risk="detail.risk" />
            <span class="op-status-chip">Confiança {{ detail.confidence }}</span>
            <AutonomyBadge :autonomy="detail.autonomy" />
          </dd>
        </div>
        <div>
          <dt>Impacto</dt>
          <dd>{{ detail.impact }}</dd>
        </div>
        <div>
          <dt>Próxima ação</dt>
          <dd>{{ detail.nextAction }}</dd>
        </div>
        <div>
          <dt>Responsável</dt>
          <dd>{{ detail.responsibleLabel }}</dd>
        </div>
        <div>
          <dt>Quando</dt>
          <dd>{{ new Date(detail.createdAt).toLocaleString("pt-BR") }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
}

.op-loading {
  color: var(--op-muted-4);
  font-size: 13px;
}

.op-error {
  max-width: 480px;
  padding: 24px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  font-size: 13px;
  color: var(--op-muted-3);
}

.op-btn {
  padding: 9px 15px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  background: transparent;
  color: var(--op-muted);
  font-family: "Sora", sans-serif;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.op-btn:hover {
  border-color: var(--op-bd-btn-h);
  color: var(--op-ink-3);
  background: var(--op-raise);
}

.op-det {
  max-width: 720px;
  padding: 24px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-det__ctx {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.op-det__ctx-name {
  font-size: 14px;
  color: var(--op-ink-2);
}

.op-status-chip {
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: var(--op-radius-xs);
  background: var(--op-raise);
  color: var(--op-muted-2);
}

.op-det__title {
  font-size: 19px;
  font-weight: 700;
  color: var(--op-ink);
  letter-spacing: -0.02em;
}

.op-det__dl {
  margin-top: 18px;
}

.op-det__dl > div {
  padding: 12px 0;
  border-bottom: 1px solid var(--op-line);
}

.op-det__dl dt {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--op-muted-5);
}

.op-det__dl dd {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--op-ink-3);
}

.op-det__list {
  margin: 0;
  padding-left: 18px;
}

.op-det--chosen {
  color: var(--op-green);
  font-weight: 600;
}

.op-det__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
