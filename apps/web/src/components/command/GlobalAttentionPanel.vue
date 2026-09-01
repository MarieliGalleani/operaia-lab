<script setup lang="ts">
/**
 * Camada global de atenção (P1.14A / Parte C).
 * Puramente composta a partir de dados já buscados pelo Command Center
 * (CommandCenterDto.attention) — nenhuma chamada de rede nova aqui.
 */
import { computed } from "vue";
import { useRouter } from "vue-router";
import type { AttentionItem } from "@/data/office-command";

const props = defineProps<{
  items: readonly AttentionItem[];
}>();

const router = useRouter();

const count = computed(() => props.items.length);

const SEVERITY_ORDER: Record<AttentionItem["severity"], number> = {
  blocker: 0,
  critical: 1,
  warning: 2,
  info: 3,
};

const sorted = computed(() =>
  [...props.items].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  ),
);

function go(item: AttentionItem): void {
  void router.push(item.href);
}
</script>

<template>
  <section
    v-if="count > 0"
    class="attn panel"
    aria-labelledby="attn-title"
  >
    <header class="attn__head">
      <span class="attn__dot" aria-hidden="true">🔴</span>
      <h2 id="attn-title" class="attn__title">
        {{ count }} {{ count === 1 ? "coisa precisa" : "coisas precisam" }} de você
      </h2>
    </header>
    <ul class="attn__list">
      <li
        v-for="item in sorted"
        :key="item.id"
        class="attn__item"
        :class="`attn__item--${item.severity}`"
        role="button"
        tabindex="0"
        @click="go(item)"
        @keyup.enter="go(item)"
      >
        <span class="attn__item-title">{{ item.title }}</span>
        <span class="attn__item-detail">{{ item.detail }}</span>
        <span class="attn__item-arrow" aria-hidden="true">→</span>
      </li>
    </ul>
  </section>
  <section v-else class="attn attn--calm panel" aria-labelledby="attn-title">
    <header class="attn__head">
      <span class="attn__dot attn__dot--calm" aria-hidden="true">●</span>
      <h2 id="attn-title" class="attn__title">Nada precisa de você agora</h2>
    </header>
  </section>
</template>

<style scoped>
.attn {
  padding: 16px 18px;
  margin-bottom: var(--space-3);
}

.attn--calm {
  opacity: 0.85;
}

.attn__head {
  display: flex;
  align-items: center;
}

.attn__dot {
  margin-right: 10px;
  font-size: 12px;
}

.attn__dot--calm {
  color: #34d399;
}

.attn__title {
  font-size: var(--text-md);
  font-weight: 700;
}

.attn__list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.attn__item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s var(--ease), transform 0.15s var(--ease);
}

.attn__item:last-child {
  margin-bottom: 0;
}

.attn__item:hover,
.attn__item:focus-visible {
  border-color: var(--brand-line);
  transform: translateX(2px);
}

.attn__item--blocker,
.attn__item--critical {
  border-left: 3px solid var(--danger);
}

.attn__item--warning {
  border-left: 3px solid #fbbf24;
}

.attn__item--info {
  border-left: 3px solid var(--border);
}

.attn__item-title {
  font-weight: 600;
  font-size: var(--text-sm);
  margin-right: 10px;
}

.attn__item-detail {
  flex: 1;
  font-size: var(--text-xs);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attn__item-arrow {
  margin-left: 10px;
  color: var(--text-soft);
}

@media (max-width: 768px) {
  .attn__item-detail {
    white-space: normal;
  }
}
</style>
