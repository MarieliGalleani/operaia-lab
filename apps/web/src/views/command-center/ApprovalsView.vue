<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import RiskBadge from "@/components/command/RiskBadge.vue";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { ApprovalListItem } from "@/data/office-command";

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));

const items = ref<readonly ApprovalListItem[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");

const pending = computed(() => items.value.filter((i) => i.status === "PENDING"));

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
  <OperationalHeader
    :floor="floor"
    :scope-line="`${floor.name} · dados isolados`"
    title="Aprovações pendentes"
    lede="O escritório só pede uma aprovação quando a política exige intervenção humana."
    :show-cta="false"
    :refreshing="state === 'loading'"
    @refresh="loadApprovals"
  />
  <div class="op-content">
    <p v-if="state === 'loading'" class="op-loading">Carregando aprovações…</p>
    <div v-else-if="state === 'error'" class="op-error" role="alert">
      <p class="op-error__title">Não foi possível carregar as aprovações</p>
      <p class="op-error__body">Tente novamente em instantes.</p>
      <button type="button" class="op-btn-retry" @click="loadApprovals">Tentar de novo</button>
    </div>
    <template v-else>
      <p v-if="pending.length === 0" class="op-empty-inline">
        Você não possui aprovações pendentes agora.
      </p>
      <div v-else class="op-approvals-list">
        <router-link
          v-for="item in pending"
          :key="item.id"
          :to="`/app/floor/dev/command/approvals/${item.id}`"
          class="op-approval-card"
        >
          <p class="op-eyebrow-sm">{{ item.workspaceName }}</p>
          <h3 class="op-approval-card__title">{{ item.title }}</h3>
          <p class="op-approval-card__sum">{{ item.actionSummary }}</p>
          <div class="op-approval-card__foot">
            <RiskBadge :risk="item.risk" />
            <span class="op-status-chip">{{ item.status }}</span>
          </div>
        </router-link>
      </div>
    </template>
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
  color: var(--op-muted-4);
  font-size: 13px;
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-error {
  max-width: 480px;
  padding: 24px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-error__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin-bottom: 6px;
}

.op-error__body {
  font-size: 12.5px;
  color: var(--op-muted-3);
  margin-bottom: 14px;
}

.op-btn-retry {
  padding: 8px 14px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-raise);
  color: var(--op-ink-2);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.op-approvals-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 640px;
}

.op-approval-card {
  display: block;
  padding: 16px 18px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.op-approval-card:hover {
  border-color: var(--op-line-strong);
  background: var(--op-raise);
}

.op-approval-card__title {
  margin-top: 6px;
  font-size: 15px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-approval-card__sum {
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--op-muted-3);
}

.op-approval-card__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
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
</style>
