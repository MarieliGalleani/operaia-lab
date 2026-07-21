<script setup lang="ts">
import { computed } from "vue";
import { useInteractiveOffice } from "../composables/useInteractiveOffice";

const { events, getEmployee } = useInteractiveOffice();

const latest = computed(() => events.value[0]);

function actorEmoji(actorId: string): string {
  return getEmployee(actorId)?.emoji ?? "•";
}
</script>

<template>
  <transition name="ticker">
    <div v-if="latest" :key="latest.id" class="ticker">
      <span class="ticker__pulse" />
      <span class="ticker__time">{{ latest.time }}</span>
      <span class="ticker__actor">{{ actorEmoji(latest.actorId) }}</span>
      <span class="ticker__msg">{{ latest.message }}</span>
    </div>
  </transition>
</template>

<style scoped>
.ticker {
  display: inline-flex;
  align-items: center;
  max-width: 420px;
  padding: 7px 13px;
  background: rgba(30, 27, 75, 0.92);
  color: #fff;
  border-radius: 999px;
  font-size: 12px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.28);
}

.ticker__pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34d399;
  margin-right: 8px;
  animation: ticker-pulse 1.4s ease-in-out infinite;
}

.ticker__time {
  font-weight: 700;
  opacity: 0.7;
  margin-right: 8px;
  font-variant-numeric: tabular-nums;
}

.ticker__actor {
  margin-right: 5px;
}

.ticker__msg {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticker-enter-active,
.ticker-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.ticker-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.ticker-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  position: absolute;
}

@keyframes ticker-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.8);
  }
}
</style>
