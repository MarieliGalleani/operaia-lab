<script setup lang="ts">
/**
 * Entrada do mundo virtual: Opera Campus (Recepção Principal).
 *
 * A arquitetura do mundo é o grafo de mapas; esta página apenas escolhe o
 * mapa inicial do produto. Sem lógica de Residente na engine.
 *
 * Diretório (P1.22): a praça já suporta qualquer quantidade de Residentes
 * via registro (campus-resident-entrances.ts), mas só dava pra chegar
 * neles andando até a fachada certa — sem letreiro, sem lista, fácil de
 * se perder. O diretório é só um atalho de UI (chama runtime.loadMap
 * direto); não cria regra nova de navegação nem conhece Residente algum
 * além do que já está no registro do domínio espacial.
 */
import { computed, ref } from "vue";
import { CAMPUS_RECEPTION_MAP_ID } from "@/modules/office-domain/data/campus-ids";
import { CAMPUS_RESIDENT_ENTRANCES } from "@/modules/office-domain/data/campus-resident-entrances";
import { createOfficeWorldProvider } from "@/modules/office-domain/office-world-data-provider";
import VirtualWorld from "@/modules/virtual-world/vue/VirtualWorld.vue";

const provider = createOfficeWorldProvider();
const worldRef = ref<InstanceType<typeof VirtualWorld> | null>(null);
const directoryOpen = ref(false);
const currentMapId = ref(CAMPUS_RECEPTION_MAP_ID);
const traveling = ref<string | null>(null);

const residents = computed(() => CAMPUS_RESIDENT_ENTRANCES);

function onReady(engineId: string): void {
  console.log("[campus] engine pronto:", engineId);
}

function onMapLoaded(mapId: string): void {
  console.log("[campus] mapa carregado:", mapId);
  currentMapId.value = mapId;
}

async function goToResident(targetMapId: string): Promise<void> {
  if (traveling.value) return;
  traveling.value = targetMapId;
  try {
    await worldRef.value?.runtime?.loadMap(targetMapId);
  } finally {
    traveling.value = null;
    directoryOpen.value = false;
  }
}
</script>

<template>
  <div class="campus-world">
    <VirtualWorld
      ref="worldRef"
      :provider="provider"
      :map-id="CAMPUS_RECEPTION_MAP_ID"
      scope-id="opera-campus"
      engine-id="pixi"
      @ready="onReady"
      @map-loaded="onMapLoaded"
    />

    <button
      type="button"
      class="directory-toggle"
      :aria-expanded="directoryOpen"
      @click="directoryOpen = !directoryOpen"
    >
      <span aria-hidden="true">🏢</span> Diretório
    </button>

    <div v-if="directoryOpen" class="directory-panel" role="dialog" aria-label="Diretório de Residentes">
      <div class="directory-panel__head">
        <p class="directory-panel__title">Residentes do Campus</p>
        <button type="button" class="directory-panel__close" aria-label="Fechar" @click="directoryOpen = false">✕</button>
      </div>
      <ul class="directory-list">
        <li v-for="r in residents" :key="r.residentId">
          <button
            type="button"
            class="directory-item"
            :class="{ 'is-current': currentMapId === r.targetMapId }"
            :disabled="traveling !== null"
            @click="goToResident(r.targetMapId)"
          >
            <span class="directory-item__label">{{ r.label }}</span>
            <span v-if="currentMapId === r.targetMapId" class="directory-item__here">você está aqui</span>
            <span v-else-if="traveling === r.targetMapId" class="directory-item__here">indo…</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.campus-world {
  position: relative;
  height: 100vh;
  min-height: 620px;
}

.directory-toggle {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--op-line-strong, rgba(148, 163, 184, 0.24));
  background: var(--op-panel, rgba(14, 21, 36, 0.78));
  color: var(--op-ink-3, #f1f5f9);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.directory-toggle:hover {
  border-color: var(--op-accent, #8b5cf6);
}

.directory-toggle:focus-visible {
  outline: 2px solid var(--op-accent, #8b5cf6);
  outline-offset: 2px;
}

.directory-panel {
  position: absolute;
  top: 56px;
  left: 12px;
  width: 240px;
  max-height: min(70vh, 420px);
  overflow-y: auto;
  border-radius: 12px;
  border: 1px solid var(--op-line-strong, rgba(148, 163, 184, 0.24));
  background: var(--op-panel, rgba(14, 21, 36, 0.92));
  box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.6);
}

.directory-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--op-line-strong, rgba(148, 163, 184, 0.16));
}

.directory-panel__title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--op-ink-3, #f1f5f9);
}

.directory-panel__close {
  border: none;
  background: none;
  color: var(--op-ink-3, #f1f5f9);
  opacity: 0.7;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 2px;
}

.directory-panel__close:hover {
  opacity: 1;
}

.directory-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.directory-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--op-ink-3, #f1f5f9);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.directory-item:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.14);
}

.directory-item:disabled {
  cursor: default;
}

.directory-item.is-current {
  color: var(--op-accent, #8b5cf6);
  font-weight: 600;
}

.directory-item__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.directory-item__here {
  flex: none;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}
</style>
