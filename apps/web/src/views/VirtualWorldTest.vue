<script setup lang="ts">
/**
 * Rota experimental /virtual-world-test.
 *
 * Renderiza um mapa "sandbox" genérico usando o <VirtualWorld /> conectado ao
 * PixiWorldEngine. Existe apenas para validar o render por dados — NÃO substitui
 * /office e NÃO contém lógica de negócio.
 */
import VirtualWorld from "@/modules/virtual-world/vue/VirtualWorld.vue";

function onReady(engineId: string): void {
  console.log("[virtual-world-test] engine pronto:", engineId);
}

function onMapLoaded(mapId: string): void {
  console.log("[virtual-world-test] mapa carregado:", mapId);
}
</script>

<template>
  <div class="vw-test">
    <header class="vw-test__bar">
      <span class="vw-test__title">Virtual World — Teste (sandbox)</span>
      <RouterLink class="vw-test__link" to="/office">← Voltar ao escritório</RouterLink>
    </header>
    <div class="vw-test__stage">
      <VirtualWorld
        map-id="sandbox"
        engine-id="pixi"
        scope-id="operaia"
        @ready="onReady"
        @map-loaded="onMapLoaded"
      />
    </div>
  </div>
</template>

<style scoped>
.vw-test {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background: #0f1020;
}

.vw-test__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  color: #e6e6f0;
  background: #14162c;
  border-bottom: 1px solid rgba(108, 92, 231, 0.35);
}

.vw-test__title {
  font-weight: 600;
  font-size: 14px;
}

.vw-test__link {
  color: #a89bff;
  text-decoration: none;
  font-size: 13px;
}

.vw-test__link:hover {
  text-decoration: underline;
}

.vw-test__stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}
</style>
