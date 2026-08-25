<script setup lang="ts">
import {
  AUTOMATION_STATUS_LABEL,
  type AutomationListItem,
} from "@/data/office-command";
import RiskBadge from "./RiskBadge.vue";
import AutonomyBadge from "./AutonomyBadge.vue";

defineProps<{ item: AutomationListItem }>();
</script>

<template>
  <router-link :to="`/app/automations/${item.id}`" class="auto panel card--lift">
    <div class="auto__head">
      <p class="eyebrow">{{ item.workspaceName }}</p>
      <span class="badge badge--dot">{{ AUTOMATION_STATUS_LABEL[item.status] }}</span>
    </div>
    <h3 class="auto__title">{{ item.name }}</h3>
    <p class="auto__obj">{{ item.objective }}</p>
    <p class="auto__trig">Trigger: {{ item.triggerLabel }}</p>
    <div class="auto__foot">
      <RiskBadge :risk="item.risk" />
      <AutonomyBadge :autonomy="item.autonomy" />
    </div>
  </router-link>
</template>

<style scoped>
.auto {
  display: block;
  padding: 16px 18px;
  color: inherit;
  margin-bottom: 12px;
}
.auto__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.auto__title {
  margin-top: 8px;
  font-size: var(--text-md);
}
.auto__obj,
.auto__trig {
  margin-top: 6px;
  font-size: var(--text-sm);
}
.auto__foot {
  display: flex;
  flex-wrap: wrap;
  margin-top: 12px;
}
.auto__foot > * {
  margin-right: 8px;
  margin-bottom: 4px;
}
</style>
