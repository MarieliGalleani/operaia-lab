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

// Status ao vivo só é buscado quando o mapa carrega (ver live-agent-status.ts).
// Se a aba ficar aberta e o usuário voltar depois de um tempo fora (ex: fechou
// o notebook), recarrega o mapa pra trazer o estado atual dos agentes.
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

onMounted(() => {
  document.addEventListener("visibilitychange", onVisibilityChange);
});

onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", onVisibilityChange);
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
</template>

<style scoped>
.office-world {
  position: relative;
  height: 100vh;
  min-height: 620px;
}

.office-world__refresh {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 5;
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
