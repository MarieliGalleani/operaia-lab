<script setup lang="ts">
import { computed } from "vue";
import { AUTONOMY_LABEL, type AutonomyLevel } from "@/data/office-command";

const props = defineProps<{ autonomy: AutonomyLevel }>();

const cls = computed(() => {
  const map: Record<AutonomyLevel, string> = {
    READ_PLAN: "autonomy--read",
    CONTROLLED: "autonomy--controlled",
    AUTONOMOUS: "autonomy--auto",
    HUMAN_APPROVAL: "autonomy--human",
  };
  return map[props.autonomy];
});
const label = computed(() => AUTONOMY_LABEL[props.autonomy]);
</script>

<template>
  <span class="autonomy badge" :class="cls" :title="`Autonomia ${label}`">
    Autonomia {{ label }}
  </span>
</template>

<style scoped>
.autonomy--read {
  color: var(--autonomy-read);
  background: var(--info-soft);
}
.autonomy--controlled {
  color: var(--autonomy-controlled);
  background: var(--brand-soft);
}
.autonomy--auto {
  color: var(--autonomy-auto);
  background: var(--success-soft);
}
.autonomy--human {
  color: var(--autonomy-human);
  background: var(--warning-soft);
}
</style>
