<script setup lang="ts">
import { onMounted, ref } from "vue";
import ApprovalCard from "@/components/command/ApprovalCard.vue";
import EmptyState from "@/components/command/EmptyState.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { ApprovalListItem } from "@/data/office-command";

const items = ref<readonly ApprovalListItem[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");

onMounted(async () => {
  try {
    items.value = await officeCommandClient.listApprovals();
    state.value = "ready";
  } catch (error) {
    console.log("[approvals] load failed", error);
    state.value = "error";
  }
});
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Comando › Aprovações</p>
        <h1 class="page__title">Aprovações</h1>
      </div>
      <router-link to="/app/command" class="btn btn--ghost">Command Center</router-link>
    </header>
    <div class="studio__stage">
      <p class="backend-note">
        BACKEND DEPENDENCY P0.3C — lista pode ser demonstrativa até o contrato existir.
      </p>
      <LoadingState v-if="state === 'loading'" />
      <p v-else-if="state === 'error'" role="alert">Falha ao carregar aprovações.</p>
      <template v-else>
        <ApprovalCard
          v-for="item in items.filter((i) => i.status === 'PENDING')"
          :key="item.id"
          :item="item"
        />
        <EmptyState
          v-if="!items.some((i) => i.status === 'PENDING')"
          title="Nenhuma aprovação pendente"
          body="O escritório só solicita você quando a política exige."
          cta-label="Nova demanda"
          cta-to="/app/command/new"
        />
      </template>
    </div>
  </div>
</template>
