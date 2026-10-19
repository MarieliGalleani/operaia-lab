<script setup lang="ts">
/**
 * Rosto do personagem pixel-art (Interface 3.0) — recorte da cabeca do
 * sprite do agente. Quem nao tem sprite (ex.: vaga aberta) cai no emoji.
 */
import { computed } from "vue";
import { CAST } from "@/modules/office-3d/floors-3d";

const props = withDefaults(
  defineProps<{ employeeId: string; fallback?: string; size?: number; title?: string }>(),
  { fallback: "•", size: 24, title: undefined },
);

const sprite = computed(() => CAST[props.employeeId]?.sprite ?? null);
</script>

<template>
  <span
    v-if="sprite"
    class="agent-face"
    :style="{ width: `${size}px`, height: `${size}px`, backgroundImage: `url(${sprite})` }"
    :title="title"
    role="img"
    :aria-label="title ?? CAST[employeeId]?.name ?? employeeId"
  />
  <span v-else class="agent-face agent-face--emoji" :title="title">{{ fallback }}</span>
</template>

<style scoped>
.agent-face {
  display: inline-block;
  flex: none;
  border-radius: 50%;
  background-color: var(--op-raise, #1a2438);
  background-repeat: no-repeat;
  /* o sprite e 1:2; ampliar 2x e alinhar no topo mostra so a cabeca */
  background-size: 190% auto;
  background-position: 50% 4%;
  image-rendering: pixelated;
  box-shadow: 0 0 0 2px var(--op-panel, #0b0c10);
}

.agent-face--emoji {
  display: inline-grid;
  place-items: center;
  width: auto;
  height: auto;
  background: none;
  box-shadow: none;
}
</style>
