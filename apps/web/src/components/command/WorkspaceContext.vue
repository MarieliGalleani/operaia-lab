<script setup lang="ts">
defineProps<{
  kind?: "lab" | "client";
  name: string;
}>();
</script>

<template>
  <div class="ws-ctx" role="status">
    <span class="badge" :class="kind === 'lab' ? 'badge--active' : 'badge--planned'">
      {{ kind === "lab" ? "OperaIA.lab" : "Cliente" }}
    </span>
    <strong class="ws-ctx__name">{{ name }}</strong>
    <slot />
  </div>
</template>

<style scoped>
.ws-ctx {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.ws-ctx__name {
  margin-left: 10px;
  font-size: var(--text-md);
}
</style>
