<script setup lang="ts">
defineProps<{ active: boolean }>();
</script>

<template>
  <span v-if="active" class="task-indicator" title="Carregando uma tarefa">📋</span>
</template>

<style scoped>
.task-indicator {
  position: absolute;
  right: -10px;
  top: -6px;
  font-size: 13px;
  animation: task-float 1.4s ease-in-out infinite;
  filter: drop-shadow(0 2px 3px rgba(15, 23, 42, 0.25));
}

@keyframes task-float {
  0%,
  100% {
    transform: translateY(0) rotate(-4deg);
  }
  50% {
    transform: translateY(-3px) rotate(4deg);
  }
}
</style>
