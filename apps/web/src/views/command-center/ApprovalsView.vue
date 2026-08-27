<script setup lang="ts">
import { onMounted, ref } from "vue";
import ApprovalCard from "@/components/command/ApprovalCard.vue";
import EmptyState from "@/components/command/EmptyState.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { ApprovalListItem } from "@/data/office-command";

const items = ref<readonly ApprovalListItem[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");

async function loadApprovals(): Promise<void> {
  state.value = "loading";
  try {
    items.value = await officeCommandClient.listApprovals();
    state.value = "ready";
  } catch (error) {
    console.log("[approvals] load failed", error);
    state.value = "error";
  }
}

onMounted(loadApprovals);
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Equipe › Meu controle</p>
        <h1 class="page__title">Aprovações pendentes</h1>
      </div>
      <router-link to="/app/command" class="btn btn--ghost">Command Center</router-link>
    </header>
    <div class="studio__stage">
      <LoadingState v-if="state === 'loading'" />
      <section v-else-if="state === 'error'" class="panel approvals__error" role="alert">
        <p>Não foi possível carregar as aprovações pendentes.</p>
        <button type="button" class="btn btn--primary" @click="loadApprovals">
          Tentar de novo
        </button>
      </section>
      <template v-else>
        <ApprovalCard
          v-for="item in items.filter((i) => i.status === 'PENDING')"
          :key="item.id"
          :item="item"
        />
        <EmptyState
          v-if="!items.some((i) => i.status === 'PENDING')"
          title="Você não possui aprovações pendentes"
          body="O escritório só solicita uma aprovação quando a política exige intervenção humana."
          cta-label="Nova demanda"
          cta-to="/app/command/new"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.approvals__error {
  padding: 18px;
}

.approvals__error .btn {
  margin-top: 12px;
}
</style>
