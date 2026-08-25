<script setup lang="ts">
import type { AttentionItem } from "@/data/office-command";
import RiskBadge from "./RiskBadge.vue";

defineProps<{ item: AttentionItem }>();
</script>

<template>
  <article class="att panel" :class="`att--${item.severity}`">
    <div class="att__body">
      <p class="eyebrow">{{ item.kind === "approval" ? "Aprovação" : "Atenção" }}</p>
      <h3 class="att__title">{{ item.title }}</h3>
      <p class="att__detail">{{ item.detail }}</p>
      <div class="att__meta">
        <span v-if="item.workspaceName" class="att__ws">{{ item.workspaceName }}</span>
        <RiskBadge v-if="item.risk" :risk="item.risk" />
      </div>
    </div>
    <router-link :to="item.href" class="btn btn--primary">Revisar</router-link>
  </article>
</template>

<style scoped>
.att {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 18px;
  margin-bottom: 12px;
}
.att--blocker,
.att--critical {
  border-color: rgba(248, 113, 113, 0.35);
  background: var(--danger-soft);
}
.att--warning {
  border-color: rgba(251, 191, 36, 0.28);
}
.att__title {
  font-size: var(--text-md);
  margin-top: 4px;
}
.att__detail {
  margin-top: 6px;
  font-size: var(--text-sm);
}
.att__meta {
  display: flex;
  align-items: center;
  margin-top: 10px;
}
.att__ws {
  margin-right: 8px;
  font-size: var(--text-xs);
  color: var(--text-soft);
}
.att .btn {
  flex-shrink: 0;
  margin-left: 16px;
}
@media (max-width: 768px) {
  .att {
    flex-direction: column;
  }
  .att .btn {
    margin-left: 0;
    margin-top: 12px;
    width: 100%;
  }
}
</style>
