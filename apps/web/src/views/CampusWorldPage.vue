<script setup lang="ts">
/**
 * Entrada do mundo virtual: Opera Campus (Recepção Principal).
 *
 * A arquitetura do mundo é o grafo de mapas; esta página apenas escolhe o
 * mapa inicial do produto. Sem lógica de Residente na engine.
 */
import { CAMPUS_RECEPTION_MAP_ID } from "@/modules/office-domain/data/campus-ids";
import { createOfficeWorldProvider } from "@/modules/office-domain/office-world-data-provider";
import VirtualWorld from "@/modules/virtual-world/vue/VirtualWorld.vue";

const provider = createOfficeWorldProvider();

function onReady(engineId: string): void {
  console.log("[campus] engine pronto:", engineId);
}

function onMapLoaded(mapId: string): void {
  console.log("[campus] mapa carregado:", mapId);
}
</script>

<template>
  <div class="campus-world">
    <VirtualWorld
      :provider="provider"
      :map-id="CAMPUS_RECEPTION_MAP_ID"
      scope-id="opera-campus"
      engine-id="pixi"
      @ready="onReady"
      @map-loaded="onMapLoaded"
    />
  </div>
</template>

<style scoped>
.campus-world {
  height: 100vh;
  min-height: 620px;
}
</style>
