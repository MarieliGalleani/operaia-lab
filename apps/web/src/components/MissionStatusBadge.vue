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
  CREATED: "st--created",
  QUEUED: "st--queued",
  RUNNING: "st--running",
  WAITING: "st--waiting",
  COMPLETED: "st--completed",
  FAILED: "st--failed",
  CANCELLED: "st--created",
};

const label = computed(() => LABEL[props.status] ?? props.status);
const cls = computed(() => CLASS[props.status] ?? "st--created");
</script>

<template>
  <span class="st badge badge--dot" :class="cls">{{ label }}</span>
</template>

<style scoped>
.st--created {
  color: var(--text-muted);
  background: var(--surface-2);
}
.st--queued {
  color: var(--info);
  background: var(--info-soft);
}
.st--running {
  color: var(--success);
  background: var(--success-soft);
}
.st--waiting {
  color: var(--warning);
  background: var(--warning-soft);
}
.st--completed {
  color: var(--accent);
  background: var(--accent-soft);
}
.st--failed {
  color: var(--danger);
  background: var(--danger-soft);
}
</style>
