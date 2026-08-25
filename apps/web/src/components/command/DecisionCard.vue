<script setup lang="ts">
import type { DecisionSummaryItem } from "@/data/office-command";
import RiskBadge from "./RiskBadge.vue";
import AutonomyBadge from "./AutonomyBadge.vue";

defineProps<{ item: DecisionSummaryItem }>();
</script>

<template>
  <router-link :to="`/app/decisions/${item.id}`" class="dec panel card--lift">
    <p class="eyebrow">Decisão</p>
    <h3 class="dec__title">{{ item.title }}</h3>
    <p class="dec__why">{{ item.rationale }}</p>
    <div class="dec__badges">
      <RiskBadge :risk="item.risk" />
      <AutonomyBadge :autonomy="item.autonomy" />
    </div>
    <p class="dec__next">Próxima ação: {{ item.nextAction }}</p>
  </router-link>
</template>

<style scoped>
.dec {
  display: block;
  padding: 16px 18px;
  color: inherit;
  margin-bottom: 12px;
}
.dec__title {
  margin-top: 6px;
  font-size: var(--text-md);
}
.dec__why {
  margin-top: 8px;
  font-size: var(--text-sm);
}
.dec__badges {
  display: flex;
  flex-wrap: wrap;
  margin-top: 10px;
}
.dec__badges > * {
  margin-right: 8px;
  margin-bottom: 4px;
}
.dec__next {
  margin-top: 10px;
  font-size: var(--text-xs);
  color: var(--text-soft);
}
</style>
