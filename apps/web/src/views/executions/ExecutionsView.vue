<script setup lang="ts">
import { onMounted, ref } from "vue";
import EmptyState from "@/components/command/EmptyState.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { ExecutionListItem } from "@/data/office-command";

const items = ref<readonly ExecutionListItem[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");

onMounted(async () => {
  try {
    items.value = await officeCommandClient.listExecutions();
    state.value = "ready";
  } catch (error) {
    console.log("[executions] failed", error);
    state.value = "error";
  }
});
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Trabalho › Execuções</p>
        <h1 class="page__title">Execuções</h1>
      </div>
    </header>
    <div class="studio__stage">
      <p class="backend-note">BACKEND DEPENDENCY P0.3C — execution ledger do Office.</p>
      <LoadingState v-if="state === 'loading'" />
      <p v-else-if="state === 'error'" role="alert">Falha ao carregar execuções.</p>
      <template v-else>
        <router-link
          v-for="item in items"
          :key="item.id"
          :to="`/app/executions/${item.id}`"
          class="panel exec card--lift"
        >
          <p class="eyebrow">{{ item.workspaceName }}</p>
          <h3>{{ item.automationName }}</h3>
          <p>{{ item.status }} · {{ new Date(item.startedAt).toLocaleString("pt-BR") }}</p>
        </router-link>
        <EmptyState
          v-if="!items.length"
          title="Nenhuma execução"
          body="Quando uma automação rodar, o rastro aparece aqui."
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.exec {
  display: block;
  padding: 16px 18px;
  color: inherit;
  margin-bottom: 12px;
}
.exec h3 {
  margin-top: 6px;
  font-size: var(--text-md);
}
.exec p {
  margin-top: 6px;
  font-size: var(--text-sm);
}
</style>
