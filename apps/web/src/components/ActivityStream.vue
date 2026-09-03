<script setup lang="ts">
import { computed } from "vue";
import { useOffice } from "@/composables/useOffice";
import type { Activity, ActivityKind } from "@/types/office";
import { formatTime } from "@/utils/format";

const props = defineProps<{
  activities: readonly Activity[];
  limit?: number;
}>();

const { employeeById } = useOffice();

const KIND_ICON: Record<ActivityKind, string> = {
  PLAN: "🧭",
  BRIEFING: "📨",
  TASK: "✅",
  REVIEW: "🔍",
  DELEGATION: "🤝",
};

const visible = computed(() =>
  props.limit ? props.activities.slice(0, props.limit) : props.activities,
);

function actorEmoji(actorId: string): string {
  return employeeById(actorId)?.emoji ?? "•";
}
</script>

<template>
  <ul class="op-stream">
    <li v-for="item in visible" :key="item.id" class="op-stream__item">
      <time class="op-stream__time">{{ formatTime(item.timestamp) }}</time>
      <span class="op-stream__rail">
        <span class="op-stream__dot">{{ KIND_ICON[item.kind] }}</span>
      </span>
      <p class="op-stream__msg">
        <span class="op-stream__actor">{{ actorEmoji(item.actorId) }}</span>
        {{ item.message }}
      </p>
    </li>
    <li v-if="visible.length === 0" class="op-stream__empty">
      Nenhuma atividade por aqui ainda.
    </li>
  </ul>
</template>

<style scoped>
.op-stream {
  list-style: none;
  margin: 0;
  padding: 0;
}

.op-stream__item {
  display: flex;
  align-items: flex-start;
  padding: 12px 0;
}

.op-stream__time {
  width: 46px;
  min-width: 46px;
  font-size: 12px;
  font-weight: 700;
  color: var(--op-muted-3);
  padding-top: 7px;
}

.op-stream__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0 14px;
  align-self: stretch;
}

.op-stream__dot {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 50%;
  background: var(--op-panel);
  border: 1px solid var(--op-line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.op-stream__item:not(:last-child) .op-stream__rail::after {
  content: "";
  flex: 1;
  width: 2px;
  background: var(--op-line);
  margin-top: 4px;
}

.op-stream__msg {
  flex: 1;
  color: var(--op-ink-3);
  font-size: 13.5px;
  padding-top: 7px;
}

.op-stream__actor {
  margin-right: 4px;
}

.op-stream__empty {
  color: var(--op-muted-4);
  font-size: 13px;
  padding: 12px 0;
}
</style>
