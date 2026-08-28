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

const container = ref<HTMLElement | null>(null);
const runtime = shallowRef<WorldRuntime | null>(null);
const status = ref<"idle" | "starting" | "ready" | "error">("idle");
const follow = ref(true);

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

onMounted(async () => {
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
  runtime.value?.dispose();
  runtime.value = null;
  emit("disposed");
});

defineExpose({ runtime });
</script>

<template>
  <div class="virtual-world">
    <div ref="container" class="virtual-world__stage"></div>

    <div v-if="status === 'ready'" class="virtual-world__camera" role="group" aria-label="Controle de câmera">
      <button type="button" class="vw-btn" title="Aproximar" @click="zoomIn">+</button>
      <button type="button" class="vw-btn" title="Afastar" @click="zoomOut">−</button>
      <button type="button" class="vw-btn" title="Recentralizar no avatar" @click="recenter">◎</button>
      <button
        type="button"
        class="vw-btn vw-btn--wide"
        :class="{ 'vw-btn--active': follow }"
        :title="follow ? 'Seguindo o avatar' : 'Câmera livre'"
        @click="toggleFollow"
      >
        {{ follow ? "Seguir" : "Livre" }}
      </button>
    </div>

    <div class="virtual-world__badge" :data-status="status">
      Mundo: {{ props.mapId }} · motor {{ props.engineId }} · {{ status }}
    </div>
  </div>
</template>

<style scoped>
.virtual-world {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg, #05080f);
}

.virtual-world__stage {
  position: absolute;
  inset: 0;
}

.virtual-world__badge {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-family: ui-monospace, monospace;
  color: var(--text, #f1f5f9);
  background: rgba(14, 21, 36, 0.78);
  border: 1px solid var(--violet-line, rgba(139, 92, 246, 0.38));
  box-shadow: 0 0 20px -8px rgba(139, 92, 246, 0.5);
}

.virtual-world__badge[data-status="error"] {
  border-color: #ff6b6b;
  color: #ffd7d7;
}

.virtual-world__camera {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.vw-btn {
  width: 40px;
  height: 40px;
  margin-top: 8px;
  border-radius: 10px;
  font-size: 18px;
  line-height: 1;
  color: var(--text, #f1f5f9);
  background: rgba(14, 21, 36, 0.78);
  border: 1px solid var(--border-strong, rgba(148, 163, 184, 0.18));
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.08s ease,
    box-shadow 0.15s ease;
}

.vw-btn:first-child {
  margin-top: 0;
}

.vw-btn:hover {
  background: rgba(30, 41, 59, 0.9);
  border-color: var(--violet-line, rgba(139, 92, 246, 0.38));
}

.vw-btn:active {
  transform: scale(0.94);
}

.vw-btn--wide {
  width: 40px;
  height: auto;
  padding: 8px 0;
  font-size: 12px;
  font-family: ui-monospace, monospace;
}

.vw-btn--active {
  background: var(--gradient-brand, linear-gradient(135deg, #3b82f6, #8b5cf6));
  border-color: transparent;
  box-shadow: 0 0 16px -4px rgba(139, 92, 246, 0.6);
}
</style>
