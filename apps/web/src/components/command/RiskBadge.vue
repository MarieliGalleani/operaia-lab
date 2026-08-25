<script setup lang="ts">
import { computed } from "vue";
import { RISK_LABEL, type RiskLevel } from "@/data/office-command";

const props = defineProps<{ risk: RiskLevel }>();

const cls = computed(() => `risk--${props.risk.toLowerCase()}`);
const label = computed(() => RISK_LABEL[props.risk]);
</script>

<template>
  <span class="risk badge" :class="cls" :title="`Risco ${label}`">
    Risco {{ label }}
  </span>
</template>

<style scoped>
.risk--low {
  color: var(--risk-low);
  background: var(--success-soft);
}
.risk--medium {
  color: var(--risk-medium);
  background: var(--warning-soft);
}
.risk--high {
  color: var(--risk-high);
  background: rgba(251, 146, 60, 0.14);
}
.risk--critical {
  color: var(--risk-critical);
  background: var(--danger-soft);
}
</style>
