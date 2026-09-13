<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ status: string }>();

const LABEL: Record<string, string> = {
  CREATED: "Criada",
  QUEUED: "Na fila",
  RUNNING: "Em execução",
  WAITING: "Aguardando",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
};

const CLASS: Record<string, string> = {
  CREATED: "is-muted",
  QUEUED: "is-blue",
  RUNNING: "is-amber",
  WAITING: "is-amber",
  COMPLETED: "is-green",
  FAILED: "is-red",
  CANCELLED: "is-muted",
};

const label = computed(() => LABEL[props.status] ?? props.status);
const cls = computed(() => CLASS[props.status] ?? "is-muted");
</script>

<template>
  <span class="op-status-badge" :class="cls">{{ label }}</span>
</template>

<style scoped>
.op-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--op-radius-full);
  background: var(--op-raise);
  color: var(--op-muted-2);
  white-space: nowrap;
}

.op-status-badge.is-green {
  color: var(--op-green);
  background: var(--op-halo);
}

.op-status-badge.is-amber {
  color: var(--op-amber);
}

.op-status-badge.is-blue {
  color: var(--op-blue);
}

.op-status-badge.is-red {
  color: var(--op-red);
}
</style>
