<script setup lang="ts">
/**
 * Página do mapa da sede OperaIA.lab (Residente).
 *
 * O ponto de entrada do mundo é o Opera Campus; esta rota abre a maquete Lab.
 */
import { createOfficeWorldProvider } from "@/modules/office-domain/office-world-data-provider";
import VirtualWorld from "@/modules/virtual-world/vue/VirtualWorld.vue";

const provider = createOfficeWorldProvider();

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
      :provider="provider"
      map-id="office"
      scope-id="operaia"
      engine-id="pixi"
      @ready="onReady"
      @map-loaded="onMapLoaded"
    />
  </div>
</template>

<style scoped>
.office-world {
  height: 100vh;
  min-height: 620px;
}
</style>
