<script setup lang="ts">
defineProps<{ label?: string }>();
</script>

<template>
  <div
    class="loading panel"
    role="status"
    aria-busy="true"
    :aria-label="label ?? 'Carregando'"
  >
    <div class="skel skel--lg" />
    <div class="skel skel--md" />
    <div class="skel skel--sm" />
  </div>
</template>

<style scoped>
.loading {
  padding: 24px;
}
.skel {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--surface-2),
    var(--surface-hover),
    var(--surface-2)
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
  margin-bottom: 12px;
}
.skel--lg {
  width: 55%;
  height: 22px;
}
.skel--md {
  width: 80%;
}
.skel--sm {
  width: 40%;
}
@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
</style>
