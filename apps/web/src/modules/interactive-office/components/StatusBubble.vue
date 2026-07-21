<script setup lang="ts">
import { computed } from "vue";
import { STATE_VISUALS } from "../config/office-config";
import type { OfficeStateId } from "../types";

const props = withDefaults(
  defineProps<{ state: OfficeStateId; compact?: boolean }>(),
  { compact: false },
);

const visual = computed(() => STATE_VISUALS[props.state]);
const active = computed(
  () => props.state !== "AVAILABLE" && props.state !== "OFFLINE",
);
</script>

<template>
  <span
    class="bubble"
    :class="{ 'bubble--active': active }"
    :style="{ '--bubble-color': visual.color }"
  >
    <span class="bubble__icon">{{ visual.icon }}</span>
    <span v-if="!compact" class="bubble__label">{{ visual.label }}</span>
  </span>
</template>

<style scoped>
.bubble {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  background: #fff;
  border: 1px solid var(--bubble-color, #cbd5e1);
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: var(--bubble-color, #64748b);
  white-space: nowrap;
  box-shadow: 0 3px 8px rgba(15, 23, 42, 0.12);
}

.bubble__icon {
  font-size: 10px;
  margin-right: 3px;
}

.bubble--active {
  animation: bubble-pulse 1.8s ease-in-out infinite;
}

@keyframes bubble-pulse {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}
</style>
