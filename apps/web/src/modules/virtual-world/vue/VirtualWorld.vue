<script setup lang="ts">
/**
 * <VirtualWorld /> — casca Vue TOTALMENTE desacoplada da engine.
 *
 * Responsabilidades (apenas ponte):
 *  - montar/desmontar o WorldRuntime;
 *  - fornecer o container DOM ao motor;
 *  - repassar eventos genericos da engine como eventos Vue.
 *
 * NAO conhece PixiJS, ECS ou dados de negocio. Recebe um WorldDataProvider por
 * injecao (ports/adapters); o dominio decide qual mundo carregar. O motor e
 * resolvido pela `engine-factory` (default "pixi"; "null" para headless/testes).
 */
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";

import { WORLD_CONFIG } from "../config/world-config";
import type { WorldRuntime } from "../contracts/world-runtime";
import type { WorldDataProvider } from "../contracts/providers";
import { createWorldRuntime } from "../core/create-world-runtime";
import { createWorldEngine, type WorldEngineId } from "../engines/engine-factory";
import { createWorldDataProvider } from "../providers/provider-factory";

const props = withDefaults(
  defineProps<{
    scopeId?: string;
    mapId?: string;
    engineId?: WorldEngineId;
    provider?: WorldDataProvider;
  }>(),
  {
    scopeId: WORLD_CONFIG.defaultScopeId,
    mapId: WORLD_CONFIG.defaultMapId,
    engineId: WORLD_CONFIG.defaultEngineId,
    provider: undefined,
  },
);

const emit = defineEmits<{
  (event: "ready", engineId: string): void;
  (event: "disposed"): void;
  (event: "map-loaded", mapId: string): void;
  (event: "entity-selected", entityId: number): void;
  (event: "portal-entered", targetMapId: string): void;
}>();

const root = ref<HTMLElement | null>(null);
const container = ref<HTMLElement | null>(null);
const runtime = shallowRef<WorldRuntime | null>(null);
const status = ref<"idle" | "starting" | "ready" | "error">("idle");
const follow = ref(true);
const isFullscreen = ref(false);

function zoomIn(): void {
  runtime.value?.zoomCameraBy(1.2);
}

function zoomOut(): void {
  runtime.value?.zoomCameraBy(1 / 1.2);
}

function recenter(): void {
  follow.value = true;
  runtime.value?.recenterCamera();
}

function toggleFollow(): void {
  follow.value = !follow.value;
  runtime.value?.setCameraFollow(follow.value);
}

function toggleFullscreen(): void {
  if (!root.value) return;
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void root.value.requestFullscreen();
  }
}

function onFullscreenChange(): void {
  isFullscreen.value = document.fullscreenElement === root.value;
}

onMounted(async () => {
  document.addEventListener("fullscreenchange", onFullscreenChange);
  if (!container.value) {
    return;
  }
  status.value = "starting";

  const data = props.provider ?? createWorldDataProvider("mock");
  const engine = createWorldEngine(props.engineId);

  const instance = createWorldRuntime({
    scopeId: props.scopeId,
    initialMapId: props.mapId,
    data,
    engine,
    clockScale: WORLD_CONFIG.clockScale,
  });
  runtime.value = instance;

  instance.bus.on("map:loaded", (payload) => emit("map-loaded", payload.mapId));
  instance.bus.on("entity:selected", (payload) => emit("entity-selected", payload.entityId));
  instance.bus.on("portal:entered", (payload) => emit("portal-entered", payload.targetMapId));
  instance.bus.on("world:ready", (payload) => {
    status.value = "ready";
    emit("ready", payload.engine);
  });

  try {
    await instance.start(container.value);
  } catch (error) {
    status.value = "error";
    console.log("[VirtualWorld] falha ao iniciar o runtime:", error);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  runtime.value?.dispose();
  runtime.value = null;
  emit("disposed");
});

defineExpose({ runtime });
</script>

<template>
  <div ref="root" class="virtual-world" :class="{ 'virtual-world--fullscreen': isFullscreen }">
    <div ref="container" class="virtual-world__stage"></div>

    <div v-if="status === 'ready'" class="virtual-world__camera" role="group" aria-label="Controle de câmera">
      <button
        type="button"
        class="vw-btn"
        :aria-label="isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'"
        :title="isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'"
        @click="toggleFullscreen"
      >
        <svg v-if="!isFullscreen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
      </button>

      <div class="vw-btn-group">
        <button type="button" class="vw-btn" aria-label="Aproximar" title="Aproximar" @click="zoomIn">+</button>
        <button type="button" class="vw-btn" aria-label="Afastar" title="Afastar" @click="zoomOut">−</button>
      </div>

      <button type="button" class="vw-btn" aria-label="Recentralizar no avatar" title="Recentralizar no avatar" @click="recenter">◎</button>
      <button
        type="button"
        class="vw-btn vw-btn--wide"
        :class="{ 'vw-btn--active': follow }"
        :aria-label="follow ? 'Seguindo o avatar — clique para câmera livre' : 'Câmera livre — clique para seguir'"
        :aria-pressed="follow"
        :title="follow ? 'Seguindo o avatar' : 'Câmera livre'"
        @click="toggleFollow"
      >
        {{ follow ? "Seguir" : "Livre" }}
      </button>
    </div>

    <div v-if="status === 'starting' || status === 'error'" class="virtual-world__badge" :data-status="status">
      {{ status === "starting" ? "Carregando escritório…" : "Não foi possível carregar o mundo virtual" }}
    </div>
  </div>
</template>

<style scoped>
.virtual-world {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--op-bg, #05080f);
}

.virtual-world--fullscreen {
  background: var(--op-bg, #05080f);
}

.virtual-world__stage {
  position: absolute;
  inset: 0;
}

.virtual-world__badge {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 8px 12px;
  border-radius: var(--op-radius-sm, 8px);
  font-family: "Sora", sans-serif;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--op-ink-3, #f1f5f9);
  background: var(--op-panel, rgba(14, 21, 36, 0.78));
  border: 1px solid var(--op-line-strong, rgba(148, 163, 184, 0.24));
}

.virtual-world__badge[data-status="error"] {
  border-color: var(--op-red, #ff6b6b);
  color: var(--op-red, #ffd7d7);
}

.virtual-world__camera {
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.vw-btn-group {
  display: flex;
  flex-direction: column;
  border-radius: var(--op-radius-sm, 10px);
  overflow: hidden;
  border: 1px solid var(--op-line-strong, rgba(148, 163, 184, 0.24));
}

.vw-btn-group .vw-btn {
  border-radius: 0;
  border: none;
  border-bottom: 1px solid var(--op-line-strong, rgba(148, 163, 184, 0.24));
}

.vw-btn-group .vw-btn:last-child {
  border-bottom: none;
}

.vw-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--op-radius-sm, 10px);
  font-size: 19px;
  line-height: 1;
  color: var(--op-ink-2, #f1f5f9);
  background: var(--op-panel, rgba(14, 21, 36, 0.78));
  border: 1px solid var(--op-line-strong, rgba(148, 163, 184, 0.24));
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.08s ease;
}

.vw-btn:hover {
  background: var(--op-raise, rgba(30, 41, 59, 0.9));
  border-color: var(--op-cta, rgba(139, 92, 246, 0.38));
}

.vw-btn:active {
  transform: scale(0.94);
}

.vw-btn--wide {
  width: 44px;
  height: auto;
  padding: 9px 0;
  font-size: 11.5px;
  font-weight: 600;
  font-family: var(--op-font-mono, ui-monospace, monospace);
}

.vw-btn--active {
  background: var(--op-cta, #3b82f6);
  color: #fff;
  border-color: var(--op-cta, #3b82f6);
}
</style>
