<script setup lang="ts">
defineProps<{
  icon: string;
  label: string;
  value: number | string;
  hint?: string;
}>();
</script>

<template>
  <div class="stat card">
    <span class="stat__icon">{{ icon }}</span>
    <div class="stat__body">
      <div class="stat__value">{{ value }}</div>
      <div class="stat__label">{{ label }}</div>
      <div v-if="hint" class="stat__hint">{{ hint }}</div>
    </div>
  </div>
</template>

<style scoped>
.stat {
  display: flex;
  align-items: center;
  padding: 20px;
}

.stat__icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--brand-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-right: 16px;
}

.stat__value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
}

.stat__label {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

.stat__hint {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-soft);
}
</style>
