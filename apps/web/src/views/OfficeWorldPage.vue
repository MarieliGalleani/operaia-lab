<script setup lang="ts">
/**
 * Página do mapa da sede OperaIA.lab (Residente).
 *
 * O ponto de entrada do mundo é o Opera Campus; esta rota abre a maquete Lab.
 * `?map=<id>` permite pular direto para outro mapa do catálogo (QA/atalho —
 * não substitui a navegação normal por portais).
 */
import { computed } from "vue";
import { useRoute } from "vue-router";
import { createOfficeWorldProvider } from "@/modules/office-domain/office-world-data-provider";
import VirtualWorld from "@/modules/virtual-world/vue/VirtualWorld.vue";

const provider = createOfficeWorldProvider();
const route = useRoute();
const mapId = computed(() => {
  const q = route.query.map;
  return typeof q === "string" && q.length > 0 ? q : "office";
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
      :key="mapId"
      :provider="provider"
      :map-id="mapId"
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
