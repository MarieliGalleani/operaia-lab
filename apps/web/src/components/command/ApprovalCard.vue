<script setup lang="ts">
import type { ApprovalListItem } from "@/data/office-command";
import RiskBadge from "./RiskBadge.vue";

defineProps<{ item: ApprovalListItem }>();
</script>

<template>
  <router-link :to="`/app/command/approvals/${item.id}`" class="appr panel card--lift">
    <p class="eyebrow">{{ item.workspaceName }}</p>
    <h3 class="appr__title">{{ item.title }}</h3>
    <p class="appr__sum">{{ item.actionSummary }}</p>
    <div class="appr__foot">
      <RiskBadge :risk="item.risk" />
      <span class="badge">{{ item.status }}</span>
    </div>
  </router-link>
</template>

<style scoped>
.appr {
  display: block;
  padding: 16px 18px;
  color: inherit;
  margin-bottom: 12px;
}
.appr__title {
  margin-top: 6px;
  font-size: var(--text-md);
}
.appr__sum {
  margin-top: 8px;
  font-size: var(--text-sm);
}
.appr__foot {
  display: flex;
  align-items: center;
  margin-top: 12px;
}
.appr__foot > * {
  margin-right: 8px;
}
</style>
