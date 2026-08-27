<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import RiskBadge from "@/components/command/RiskBadge.vue";
import AutonomyBadge from "@/components/command/AutonomyBadge.vue";
import WorkspaceContext from "@/components/command/WorkspaceContext.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import {
  AUTOMATION_STATUS_LABEL,
  type AutomationDto,
} from "@/data/office-command";
import { officeCommandClient } from "@/data/adapters/office-client";

const props = defineProps<{ id: string }>();
const route = useRoute();
const id = props.id || String(route.params.id);
const detail = ref<AutomationDto | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");

onMounted(async () => {
  try {
    detail.value = await officeCommandClient.getAutomation(id);
    state.value = detail.value ? "ready" : "error";
  } catch (error) {
    console.log("[automation-detail] failed", error);
    state.value = "error";
  }
});
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Automações › Detalhe</p>
        <h1 class="page__title">{{ detail?.name ?? "Automação" }}</h1>
      </div>
      <router-link to="/app/automations" class="btn btn--ghost">Voltar</router-link>
    </header>
    <div class="studio__stage">
      <LoadingState v-if="state === 'loading'" />
      <section v-else-if="state === 'error'" class="panel det__error" role="alert">
        <p>Automação não encontrada ou indisponível.</p>
        <router-link to="/app/automations" class="btn btn--ghost">Voltar ao catálogo</router-link>
      </section>
      <section v-else-if="detail" class="panel det">
        <WorkspaceContext :name="detail.workspaceName" kind="client" />
        <span class="badge badge--dot">{{ AUTOMATION_STATUS_LABEL[detail.status] }}</span>
        <h2 class="det__heading">O que ela faz</h2>
        <p class="det__obj">{{ detail.objective }}</p>
        <h2 class="det__heading">Quando usar</h2>
        <p class="det__copy">{{ detail.triggerLabel }}</p>
        <h2 class="det__heading">O que a OperaIA faria</h2>
        <ul class="det__list">
          <li v-for="a in detail.actions" :key="a">{{ a }}</li>
        </ul>
        <h2 class="det__heading">Estado atual</h2>
        <p class="det__copy">
          {{ AUTOMATION_STATUS_LABEL[detail.status] }} · A automação pertence a {{ detail.workspaceName }}.
        </p>
        <div class="det__badges">
          <RiskBadge :risk="detail.risk" />
          <AutonomyBadge :autonomy="detail.autonomy" />
        </div>
        <router-link to="/app/command/new" class="btn btn--primary det__cta">
          Descrever uma demanda
        </router-link>
        <h2 class="det__heading">Histórico</h2>
        <ul class="det__list">
          <li v-for="h in detail.history" :key="h.executionId">
            <router-link :to="`/app/executions/${h.executionId}`">
              {{ h.status }} · {{ new Date(h.at).toLocaleString("pt-BR") }}
            </router-link>
          </li>
          <li v-if="!detail.history.length">Nenhuma execução registrada ainda.</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.det {
  padding: 22px;
  max-width: 720px;
}
.det__obj {
  margin: 12px 0;
  color: var(--text);
}
.det__heading {
  margin-top: 22px;
  font-size: var(--text-md);
}
.det__copy {
  margin-top: 8px;
  color: var(--text-muted);
}
.det__list {
  margin: 10px 0 0;
  padding-left: 20px;
  color: var(--text-muted);
}
.det__list li + li {
  margin-top: 6px;
}
.det__cta {
  margin-top: 20px;
}
.det__error {
  padding: 18px;
}
.det__error .btn {
  display: inline-block;
  margin-top: 12px;
}
.det__badges {
  margin: 12px 0 20px;
}
.det__badges > * {
  margin-right: 8px;
}
.section__title {
  margin-top: 18px;
}
</style>
