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
      <p v-else-if="state === 'error'" role="alert">Automação não encontrada.</p>
      <section v-else-if="detail" class="panel det">
        <WorkspaceContext :name="detail.workspaceName" kind="client" />
        <span class="badge badge--dot">{{ AUTOMATION_STATUS_LABEL[detail.status] }}</span>
        <p class="det__obj">{{ detail.objective }}</p>
        <p>Trigger: {{ detail.triggerLabel }}</p>
        <div class="det__badges">
          <RiskBadge :risk="detail.risk" />
          <AutonomyBadge :autonomy="detail.autonomy" />
        </div>
        <h3 class="section__title">Ações</h3>
        <ul>
          <li v-for="a in detail.actions" :key="a">{{ a }}</li>
        </ul>
        <h3 class="section__title">Histórico</h3>
        <ul>
          <li v-for="h in detail.history" :key="h.executionId">
            <router-link :to="`/app/executions/${h.executionId}`">
              {{ h.status }} · {{ new Date(h.at).toLocaleString("pt-BR") }}
            </router-link>
          </li>
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
