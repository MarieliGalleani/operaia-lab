<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import ExecutionTimeline from "@/components/command/ExecutionTimeline.vue";
import WorkspaceContext from "@/components/command/WorkspaceContext.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { ExecutionDto } from "@/data/office-command";

const props = defineProps<{ id: string }>();
const route = useRoute();
const id = props.id || String(route.params.id);
const detail = ref<ExecutionDto | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  try {
    detail.value = await officeCommandClient.getExecution(id);
    state.value = detail.value ? "ready" : "error";
  } catch (error) {
    console.log("[execution-detail] failed", error);
    if (!detail.value) state.value = "error";
  }
}

onMounted(async () => {
  await load();
  timer = setInterval(() => {
    if (detail.value?.status === "RUNNING") {
      void load();
    }
  }, 2500);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Execuções › Detalhe</p>
        <h1 class="page__title">{{ detail?.automationName ?? "Execução" }}</h1>
      </div>
      <router-link to="/app/executions" class="btn btn--ghost">Voltar</router-link>
    </header>
    <div class="studio__stage">
      <LoadingState v-if="state === 'loading'" />
      <p v-else-if="state === 'error'" role="alert">Execução não encontrada.</p>
      <section v-else-if="detail" class="panel det">
        <WorkspaceContext :name="detail.workspaceName" kind="client" />
        <p>Trigger: {{ detail.triggerLabel }}</p>
        <p>Status: {{ detail.status }}</p>
        <h3 class="section__title">Linha do tempo</h3>
        <ExecutionTimeline :steps="detail.steps" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.det {
  padding: 22px;
  max-width: 720px;
}
.section__title {
  margin: 18px 0 12px;
}
</style>
