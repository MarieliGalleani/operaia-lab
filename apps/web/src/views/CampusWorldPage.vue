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
            <span class="directory-item__badge">{{ r.label.slice(0, 2).toUpperCase() }}</span>
            <span class="directory-item__label">{{ r.label }}</span>
            <span v-if="currentMapId === r.targetMapId" class="directory-item__here">aqui</span>
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
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 15px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-panel);
  color: var(--op-muted);
  font-family: "Sora", sans-serif;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.directory-toggle:hover {
  border-color: var(--op-bd-btn-h);
  color: var(--op-ink-3);
  background: var(--op-raise);
}

.directory-toggle:focus-visible {
  outline: 2px solid var(--op-cta);
  outline-offset: 2px;
}

.directory-panel {
  position: absolute;
  top: 58px;
  left: 12px;
  z-index: 5;
  width: min(248px, calc(100vw - 24px));
  max-height: min(70vh, 420px);
  overflow-y: auto;
  border-radius: var(--op-radius);
  border: 1px solid var(--op-line-strong);
  background: var(--op-panel);
  box-shadow: 0 20px 48px -16px rgba(0, 0, 0, 0.55);
}

.directory-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px 10px;
  border-bottom: 1px solid var(--op-line);
}

.directory-panel__title {
  margin: 0;
  font-family: var(--op-font-mono);
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--op-muted-5);
}

.directory-panel__close {
  border: none;
  background: none;
  color: var(--op-muted-3);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 4px;
  border-radius: var(--op-radius-xs);
}

.directory-panel__close:hover {
  color: var(--op-ink-3);
  background: var(--op-raise);
}

.directory-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.directory-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 9px;
  border-radius: var(--op-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--op-ink-3);
  font-family: "Sora", sans-serif;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.directory-item:hover:not(:disabled) {
  background: var(--op-hover);
}

.directory-item:disabled {
  cursor: default;
}

.directory-item.is-current {
  border-color: var(--op-bd-sel);
  background: var(--op-sel);
}

.directory-item__badge {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  display: grid;
  place-items: center;
  font-family: var(--op-font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--op-muted-2);
}

.directory-item.is-current .directory-item__badge {
  color: var(--op-cta);
}

.directory-item__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.directory-item.is-current .directory-item__label {
  color: var(--op-ink);
  font-weight: 600;
}

.directory-item__here {
  flex: none;
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--op-cta);
}

.directory-panel__hint {
  margin: 0;
  padding: 9px 14px 13px;
  border-top: 1px solid var(--op-line);
  font-size: 11px;
  color: var(--op-muted-4);
}
</style>
