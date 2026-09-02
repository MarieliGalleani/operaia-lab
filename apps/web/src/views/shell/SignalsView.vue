<script setup lang="ts">
/**
 * Aba Sinais (P1.21) — nao implementada de verdade ainda.
 *
 * Nao existe GET de listagem de DomainSignal em lugar nenhum do
 * backend (so ha POST de ingestao de webhook), e o model real
 * (DomainSignalEvaluationDecision) so tem 3 valores — o handoff de
 * design pede 5 ("reutilizar"/"evitar" nao existem) e um nivel S1-S4
 * que tambem nao existe no schema. Implementar de verdade exige
 * endpoint novo e possivelmente ajustar o modelo de decisao — fora do
 * escopo desta rodada de casca/navegacao.
 */
import { computed } from "vue";
import { useRoute } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
</script>

<template>
  <OperationalHeader
    :floor="floor"
    :scope-line="`${floor.name} · dados isolados`"
    title="Sinais"
    lede="Acontecimentos das fontes deste andar convertidos em sinais, com a decisão que o gate tomou."
    :show-cta="false"
    @refresh="() => {}"
  />
  <div class="op-content">
    <div class="op-empty-card">
      <p class="op-empty-title">Sinais ainda não tem uma tela própria</p>
      <p class="op-empty-body">
        O escritório já captura sinais (GitHub, webhooks) e decide sobre eles
        internamente, mas não existe hoje um endpoint de leitura para listar
        esses sinais — só a ingestão. Construir esta aba de verdade exige um
        endpoint novo e, possivelmente, ajustar o modelo de decisão (hoje só
        suporta 3 valores).
      </p>
    </div>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
}

.op-empty-card {
  max-width: 480px;
  padding: 28px;
  border: 1px solid var(--op-line);
  border-radius: 14px;
  background: var(--op-panel);
}

.op-empty-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin-bottom: 8px;
}

.op-empty-body {
  font-size: 13px;
  line-height: 1.6;
  color: var(--op-muted-3);
}
</style>
