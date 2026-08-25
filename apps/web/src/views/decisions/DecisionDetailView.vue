<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import RiskBadge from "@/components/command/RiskBadge.vue";
import AutonomyBadge from "@/components/command/AutonomyBadge.vue";
import WorkspaceContext from "@/components/command/WorkspaceContext.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { DecisionTraceDto } from "@/data/office-command";

const props = defineProps<{ id: string }>();
const route = useRoute();
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
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Decisões › Detalhe</p>
        <h1 class="page__title">Decision Trace</h1>
      </div>
      <router-link to="/app/decisions" class="btn btn--ghost">Voltar</router-link>
    </header>
    <div class="studio__stage">
      <LoadingState v-if="state === 'loading'" />
      <p v-else-if="state === 'error'" role="alert">Decisão não encontrada.</p>
      <section v-else-if="detail" class="panel det">
        <WorkspaceContext :name="detail.workspaceName" kind="client" />
        <h2 class="section__title">{{ detail.objective }}</h2>
        <dl class="det__dl">
          <div><dt>Contexto</dt><dd>{{ detail.context }}</dd></div>
          <div>
            <dt>Opções</dt>
            <dd>
              <ul>
                <li
                  v-for="opt in detail.options"
                  :key="opt.id"
                  :class="{ 'det--chosen': opt.id === detail.chosenOptionId }"
                >
                  {{ opt.id }} — {{ opt.label }}
                  <span v-if="opt.id === detail.chosenOptionId"> (escolhida)</span>
                </li>
              </ul>
            </dd>
          </div>
          <div><dt>Por quê</dt><dd>{{ detail.rationale }}</dd></div>
          <div>
            <dt>Risco / Confiança / Autonomia</dt>
            <dd class="det__badges">
              <RiskBadge :risk="detail.risk" />
              <span class="badge">Confiança {{ detail.confidence }}</span>
              <AutonomyBadge :autonomy="detail.autonomy" />
            </dd>
          </div>
          <div><dt>Impacto</dt><dd>{{ detail.impact }}</dd></div>
          <div><dt>Próxima ação</dt><dd>{{ detail.nextAction }}</dd></div>
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
  </div>
</template>

<style scoped>
.det {
  padding: 22px;
  max-width: 760px;
}
.det__dl > div {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
.det__dl dt {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-soft);
}
.det__dl dd {
  margin: 6px 0 0;
}
.det__dl ul {
  margin: 0;
  padding-left: 18px;
}
.det--chosen {
  color: var(--success);
  font-weight: 600;
}
.det__badges > * {
  margin-right: 8px;
}
</style>
