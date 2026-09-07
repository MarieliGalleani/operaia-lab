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
  right: 16px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.office-world__live {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 13px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-panel);
  font-family: var(--op-font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--op-muted-4);
}

.office-world__live.is-on {
  color: var(--op-green);
  border-color: var(--op-bd-btn-h);
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
  padding: 9px 15px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  background: var(--op-panel);
  color: var(--op-muted);
  font-family: "Sora", sans-serif;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.office-world__refresh:hover:not(:disabled) {
  border-color: var(--op-bd-btn-h);
  color: var(--op-ink-3);
  background: var(--op-raise);
}

.office-world__refresh:disabled {
  opacity: 0.6;
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
