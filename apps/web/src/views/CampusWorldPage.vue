<script setup lang="ts">
/**
 * Entrada do mundo virtual: Opera Campus (Recepção Principal).
 *
 * A arquitetura do mundo é o grafo de mapas; esta página apenas escolhe o
 * mapa inicial do produto. Sem lógica de Residente na engine.
 *
 * "Elevador" (P1.22, adendo hub-vertical): o adendo pede hall + elevador
 * como hub de distribuição em vez de andar até a fachada certa na praça.
 * Um elevador físico com cabine/animação exigiria um novo tipo de
 * interação multi-destino que o Portal System não tem hoje (portal
 * sempre troca de mapa sozinho ao ser tocado — não dá pra interceptar
 * sem mexer no motor, e o adendo proíbe isso: "não autoriza... alterar
 * Runtime, ECS, Portal System ou engine"). Esta é a leitura pragmatica
 * do mesmo pedido: o painel de andares abre automaticamente ao chegar
 * no hall (Recepção) — você VÊ os andares e escolhe, sem precisar
 * caminhar pela praça procurando fachada. Só UI (chama runtime.loadMap
 * já público); a praça e o grafo de mapas continuam intocados.
 */
import { computed, ref } from "vue";
import { CAMPUS_RECEPTION_MAP_ID } from "@/modules/office-domain/data/campus-ids";
import { CAMPUS_RESIDENT_ENTRANCES } from "@/modules/office-domain/data/campus-resident-entrances";
import { createOfficeWorldProvider } from "@/modules/office-domain/office-world-data-provider";
import VirtualWorld from "@/modules/virtual-world/vue/VirtualWorld.vue";

const provider = createOfficeWorldProvider();
const worldRef = ref<InstanceType<typeof VirtualWorld> | null>(null);
const directoryOpen = ref(true);
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
      <span aria-hidden="true">🛗</span> Elevador
    </button>

    <div v-if="directoryOpen" class="directory-panel" role="dialog" aria-label="Elevador — escolha o andar">
      <div class="directory-panel__head">
        <p class="directory-panel__title">Elevador · escolha o andar</p>
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
      <p class="directory-panel__hint">Ou feche e ande até a fachada na praça, se preferir.</p>
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

.directory-panel__hint {
  margin: 0;
  padding: 8px 14px 12px;
  font-size: 11px;
  color: var(--op-ink-3, #f1f5f9);
  opacity: 0.6;
}
</style>
