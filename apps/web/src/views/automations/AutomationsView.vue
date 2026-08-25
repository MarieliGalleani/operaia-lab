<script setup lang="ts">
import { onMounted, ref } from "vue";
import AutomationCard from "@/components/command/AutomationCard.vue";
import EmptyState from "@/components/command/EmptyState.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { AutomationListItem } from "@/data/office-command";

const items = ref<readonly AutomationListItem[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");

onMounted(async () => {
  try {
    items.value = await officeCommandClient.listAutomations();
    state.value = "ready";
  } catch (error) {
    console.log("[automations] failed", error);
    state.value = "error";
  }
});
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Trabalho › Automações</p>
        <h1 class="page__title">Automações</h1>
      </div>
      <router-link to="/app/command/new" class="btn btn--primary">Nova demanda</router-link>
    </header>
    <div class="studio__stage">
      <p class="backend-note">BACKEND DEPENDENCY P0.3C — entidade Automation ainda não no Core.</p>
      <LoadingState v-if="state === 'loading'" />
      <p v-else-if="state === 'error'" role="alert">Falha ao carregar automações.</p>
      <template v-else>
        <AutomationCard v-for="item in items" :key="item.id" :item="item" />
        <EmptyState
          v-if="!items.length"
          title="Nenhuma automação ainda"
          body="Crie uma demanda para o escritório planejar a primeira."
          cta-label="Nova demanda"
          cta-to="/app/command/new"
        />
      </template>
    </div>
  </div>
</template>
