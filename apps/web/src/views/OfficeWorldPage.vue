<script setup lang="ts">
/**
 * Página do mapa da sede OperaIA.lab (Residente).
 *
 * O ponto de entrada do mundo é o Opera Campus; esta rota abre a maquete Lab.
 * `?map=<id>` permite pular direto para outro mapa do catálogo (QA/atalho —
 * não substitui a navegação normal por portais).
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { connectLiveStatusSocket } from "@/modules/office-domain/live-status-socket";
import { createOfficeWorldProvider } from "@/modules/office-domain/office-world-data-provider";
import VirtualWorld from "@/modules/virtual-world/vue/VirtualWorld.vue";
import type { WorldRuntime } from "@/modules/virtual-world/contracts/world-runtime";

const provider = createOfficeWorldProvider();
const route = useRoute();
const mapId = computed(() => {
  const q = route.query.map;
  return typeof q === "string" && q.length > 0 ? q : "office";
});

const worldRef = ref<{ runtime: WorldRuntime | null } | null>(null);
const refreshing = ref(false);
const live = ref(false);

// Status ao vivo só era buscado quando o mapa carregava (ver
// live-agent-status.ts) — sem push contínuo. Agora o servidor avisa via
// WebSocket (live-status-socket.ts) toda vez que um funcionário começa,
// termina ou falha uma missão, e a tela recarrega sozinha. Debounced:
// vários agentes podem mudar de estado quase juntos.
let liveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleLiveRefresh(): void {
  if (liveRefreshTimer) clearTimeout(liveRefreshTimer);
  liveRefreshTimer = setTimeout(() => void refreshStatus(), 800);
}

// Se a aba ficar aberta e o usuário voltar depois de um tempo fora (ex: fechou
// o notebook), recarrega o mapa pra trazer o estado atual dos agentes — rede
// de segurança pro caso do WebSocket ter caído enquanto a aba estava oculta.
let hiddenAt: number | null = null;
const STALE_AFTER_MS = 20_000;

async function refreshStatus(): Promise<void> {
  const runtime = worldRef.value?.runtime;
  if (!runtime || refreshing.value) return;
  refreshing.value = true;
  try {
    await runtime.loadMap(mapId.value);
  } finally {
    refreshing.value = false;
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === "hidden") {
    hiddenAt = Date.now();
    return;
  }
  if (hiddenAt !== null && Date.now() - hiddenAt > STALE_AFTER_MS) {
    void refreshStatus();
  }
  hiddenAt = null;
}

let disconnectLiveStatus: (() => void) | null = null;

onMounted(() => {
  document.addEventListener("visibilitychange", onVisibilityChange);
  disconnectLiveStatus = connectLiveStatusSocket({
    onConnectionChange: (connected) => {
      live.value = connected;
    },
    onEvent: () => {
      scheduleLiveRefresh();
    },
  });
});

onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", onVisibilityChange);
  if (liveRefreshTimer) clearTimeout(liveRefreshTimer);
  disconnectLiveStatus?.();
});

function onReady(engineId: string): void {
  console.log("[office] engine pronto:", engineId);
}

function onMapLoaded(mapId: string): void {
  console.log("[office] mapa carregado:", mapId);
}
</script>

<template>
  <div class="office-world">
    <VirtualWorld
      ref="worldRef"
      :key="mapId"
      :provider="provider"
      :map-id="mapId"
      scope-id="operaia"
      engine-id="pixi"
      @ready="onReady"
      @map-loaded="onMapLoaded"
    />
    <div class="office-world__controls">
      <span
        class="office-world__live"
        :class="{ 'is-on': live }"
        :title="live ? 'Tempo real conectado' : 'Tempo real indisponível — atualize manualmente'"
      >
        <span class="office-world__live-dot" aria-hidden="true"></span>
        {{ live ? "Ao vivo" : "Offline" }}
      </span>
      <button
        type="button"
        class="office-world__refresh"
        :disabled="refreshing"
        title="Atualizar status dos agentes"
        @click="refreshStatus"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'is-spinning': refreshing }">
          <path d="M20 11a8 8 0 1 0-2.6 6M20 5v6h-6" />
        </svg>
        {{ refreshing ? "Atualizando…" : "Atualizar" }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.office-world {
  position: relative;
  height: 100vh;
  min-height: 620px;
}

.office-world__controls {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
}

.office-world__live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  background: rgba(20, 20, 30, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.office-world__live.is-on {
  color: #7dffb0;
}

.office-world__live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.office-world__live.is-on .office-world__live-dot {
  animation: office-world-pulse 1.6s ease-in-out infinite;
}

@keyframes office-world-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.office-world__refresh {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: none;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #4c8bfa 0%, #3b82f6 45%, #8b5cf6 100%);
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.18), 0 10px 32px -6px rgba(124, 58, 237, 0.4);
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease;
}

.office-world__refresh:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.25), 0 14px 36px -6px rgba(124, 58, 237, 0.5);
}

.office-world__refresh:disabled {
  opacity: 0.7;
  cursor: wait;
}

.office-world__refresh svg {
  width: 15px;
  height: 15px;
}

.office-world__refresh svg.is-spinning {
  animation: office-world-spin 0.9s linear infinite;
}

@keyframes office-world-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
