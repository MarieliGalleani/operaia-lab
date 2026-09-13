<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import ExecutionTimeline from "@/components/command/ExecutionTimeline.vue";
import WorkspaceContext from "@/components/command/WorkspaceContext.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { ExecutionDto } from "@/data/office-command";

const props = defineProps<{ id: string }>();
const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
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
  <OperationalHeader
    :floor="floor"
    :scope-line="`${floor.name} · execução`"
    :title="detail?.automationName ?? 'Execução'"
    lede="Passo a passo real desta execução, do gatilho até o resultado final."
    :show-cta="false"
    :show-refresh="false"
  />
  <div class="op-content">
    <p v-if="state === 'loading'" class="op-loading">Carregando execução…</p>
    <p v-else-if="state === 'error'" class="op-empty-inline" role="alert">Execução não encontrada.</p>

    <section v-else-if="detail" class="op-panel">
      <WorkspaceContext :name="detail.workspaceName" kind="client" />
      <div class="op-exec-meta">
        <span><strong>Gatilho:</strong> {{ detail.triggerLabel }}</span>
        <span><strong>Status:</strong> {{ detail.status }}</span>
      </div>
      <h3 class="op-panel__title">Passo a passo</h3>
      <ExecutionTimeline :steps="detail.steps" />
    </section>
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
  font-size: 13px;
  color: var(--op-muted-3);
}

.op-panel {
  max-width: 720px;
  padding: 22px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-exec-meta {
  display: flex;
  gap: 20px;
  margin: 12px 0 20px;
  font-size: 13px;
  color: var(--op-muted-2);
}

.op-panel__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin: 0 0 14px;
}
</style>
