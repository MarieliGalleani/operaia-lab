<script setup lang="ts">
import type { WorkProgressItem } from "@/data/office-command";
import RiskBadge from "./RiskBadge.vue";

defineProps<{ item: WorkProgressItem }>();
</script>

<template>
  <router-link :to="item.href" class="work panel card--lift">
    <p class="eyebrow">{{ item.workspaceName }}</p>
    <h3 class="work__title">{{ item.objective }}</h3>
    <p class="work__step">{{ item.stepLabel }} · {{ item.progressLabel }}</p>
    <div class="work__foot">
      <RiskBadge :risk="item.risk" />
      <span v-if="item.etaLabel" class="work__eta">{{ item.etaLabel }}</span>
    </div>
  </router-link>
</template>

<style scoped>
.work {
  display: block;
  padding: 16px 18px;
  color: inherit;
  height: 100%;
}
.work__title {
  margin-top: 6px;
  font-size: var(--text-md);
}
.work__step {
  margin-top: 8px;
  font-size: var(--text-sm);
}
.work__foot {
  display: flex;
  align-items: center;
  margin-top: 12px;
}
.work__eta {
  margin-left: 8px;
  font-size: var(--text-xs);
  color: var(--text-soft);
}
</style>
