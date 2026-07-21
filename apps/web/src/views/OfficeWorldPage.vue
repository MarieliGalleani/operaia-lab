<script setup lang="ts">
/**
 * Página inicial de /office — o escritório renderizado pela engine genérica.
 *
 * O escritório entra em cena SOMENTE por dados: createOfficeWorldProvider()
 * fornece o mapa office-domain/data/office-map.ts ao WorldRuntime, que usa o
 * PixiWorldEngine para renderizar. Sem lógica de negócio aqui e sem qualquer
 * dependência do antigo módulo interactive-office.
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
