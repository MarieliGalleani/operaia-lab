<script setup lang="ts">
import { computed } from "vue";
import { STATE_VISUALS } from "../config/office-config";
import { describeAnimation } from "../engine/animation-controller";
import type { OfficeEmployee } from "../types";
import StatusBubble from "./StatusBubble.vue";
import TaskIndicator from "./TaskIndicator.vue";

const props = withDefaults(
  defineProps<{ employee: OfficeEmployee; selected?: boolean }>(),
  { selected: false },
);

const anim = computed(() => describeAnimation(props.employee));

const SHIRTS = [
  "#4f46e5",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

const shirt = computed(() => SHIRTS[hash(props.employee.id) % SHIRTS.length]);
const ring = computed(() => STATE_VISUALS[props.employee.state].color);
</script>

<template>
  <button
    type="button"
    class="avatar"
    :class="[
      `avatar--${anim.pose}`,
      {
        'avatar--selected': selected,
        'avatar--offline': !employee.hired,
      },
    ]"
    :style="{ '--ring': ring, '--shirt': shirt }"
  >
    <span v-if="anim.thoughtBubble" class="avatar__thought">💭</span>
    <StatusBubble class="avatar__bubble" :state="employee.state" compact />
    <span class="avatar__figure">
      <span class="avatar__head">{{ employee.emoji }}</span>
      <span class="avatar__body" />
      <TaskIndicator :active="employee.carryingTask" />
    </span>
    <span class="avatar__name">{{ employee.role }} — {{ employee.name }}</span>
  </button>
</template>

<style scoped>
.avatar {
  position: absolute;
  left: 0;
  bottom: 0;
  transform: translate(-50%, -100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 0;
}

.avatar__bubble {
  margin-bottom: 2px;
  transition: opacity 0.2s ease;
}

.avatar__figure {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar__head {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--ring, #16a34a);
  font-size: 15px;
  box-shadow: 0 3px 8px rgba(15, 23, 42, 0.2);
  z-index: 2;
}

.avatar__body {
  width: 22px;
  height: 24px;
  margin-top: -6px;
  border-radius: 12px 12px 7px 7px;
  background: var(--shirt, #4f46e5);
  border: 2px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 5px 10px rgba(15, 23, 42, 0.22);
}

.avatar__name {
  margin-top: 3px;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 600;
  color: #334155;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.avatar:hover .avatar__name,
.avatar--selected .avatar__name {
  opacity: 1;
}

.avatar--selected .avatar__head {
  outline: 3px solid rgba(79, 70, 229, 0.35);
  outline-offset: 2px;
}

.avatar--offline {
  opacity: 0.5;
  filter: grayscale(0.5);
}

.avatar__thought {
  position: absolute;
  top: -18px;
  right: 2px;
  font-size: 12px;
  animation: avatar-think 2.2s ease-in-out infinite;
}

.avatar--walk .avatar__figure {
  animation: avatar-walk 0.5s ease-in-out infinite;
}

.avatar--type .avatar__figure {
  animation: avatar-type 0.55s ease-in-out infinite;
}

.avatar--idle .avatar__figure,
.avatar--think .avatar__figure,
.avatar--present .avatar__figure {
  animation: avatar-breathe 3.4s ease-in-out infinite;
}

.avatar--sleep {
  opacity: 0.55;
  filter: grayscale(0.4);
}

@keyframes avatar-walk {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

@keyframes avatar-type {
  0%,
  100% {
    transform: translateY(0) rotate(-0.5deg);
  }
  50% {
    transform: translateY(-1px) rotate(0.5deg);
  }
}

@keyframes avatar-think {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.85;
  }
  50% {
    transform: translateY(-3px);
    opacity: 1;
  }
}

@keyframes avatar-breathe {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-1px) scale(1.01);
  }
}
</style>
