<script setup lang="ts">
import { computed } from "vue";
import { useInteractiveOffice } from "../composables/useInteractiveOffice";

const { events, getEmployee } = useInteractiveOffice();

const KIND_ICON: Record<string, string> = {
  PLAN: "🧭",
  BRIEFING: "📨",
  TASK: "✅",
  REVIEW: "🔍",
  DELEGATION: "🤝",
};

const visible = computed(() => events.value.slice(0, 15));

function actorEmoji(actorId: string): string {
  return getEmployee(actorId)?.emoji ?? "•";
}
</script>

<template>
  <section class="timeline">
    <header class="timeline__head">
      <span class="timeline__title">Linha do tempo</span>
      <span class="timeline__live"><i class="timeline__dot" /> ao vivo</span>
    </header>
    <ul class="timeline__list">
      <li v-for="event in visible" :key="event.id" class="timeline__item">
        <time class="timeline__time">{{ event.time }}</time>
        <span class="timeline__rail"><span class="timeline__icon">{{ KIND_ICON[event.kind] ?? "•" }}</span></span>
        <p class="timeline__msg">
          <span class="timeline__actor">{{ actorEmoji(event.actorId) }}</span>
          {{ event.message }}
        </p>
      </li>
      <li v-if="visible.length === 0" class="timeline__empty">
        Aguardando a primeira movimentação do escritório.
      </li>
    </ul>
  </section>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.timeline__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
}

.timeline__title {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}

.timeline__live {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  color: #16a34a;
  font-weight: 600;
}

.timeline__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #16a34a;
  margin-right: 5px;
  animation: timeline-pulse 1.5s ease-in-out infinite;
}

.timeline__list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}

.timeline__item {
  display: grid;
  grid-template-columns: 42px 22px 1fr;
  align-items: start;
  padding: 6px 0;
  border-top: 1px solid #f1f5f9;
}

.timeline__time {
  font-size: 11px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.timeline__rail {
  display: flex;
  justify-content: center;
}

.timeline__icon {
  font-size: 13px;
}

.timeline__msg {
  margin: 0;
  font-size: 12px;
  color: #334155;
  line-height: 1.35;
}

.timeline__actor {
  margin-right: 3px;
}

.timeline__empty {
  padding: 10px 0;
  font-size: 12px;
  color: #94a3b8;
}

@keyframes timeline-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
