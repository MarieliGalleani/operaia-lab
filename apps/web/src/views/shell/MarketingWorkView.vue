<script setup lang="ts">
/**
 * Trabalhos do andar Marketing (P1.21) — honesto vazio.
 * Marketing existe como andar na navegacao (pedido explicito), mas o
 * dominio nao tem nenhuma entidade de campanha/agencia hoje — nao ha
 * Project, Mission ou workspace algum que pertenca a este andar.
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
    title="Trabalhos"
    lede="Cada campanha ou entrega desta unidade, com seu estado real."
    :show-cta="false"
    :show-refresh="false"
  />
  <div class="op-content">
    <div class="op-empty-card">
      <p class="op-empty-title">O andar Marketing ainda não existe no domínio</p>
      <p class="op-empty-body">
        Não há nenhum Projeto, Missão ou registro real associado a este andar
        hoje — ele aparece na navegação porque foi pedido, mas nenhum dado
        real pode ser mostrado aqui até que exista uma origem de trabalho
        (uma nova <code>MissionOrigin</code> ou entidade equivalente) que
        aponte pra ele.
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
  max-width: 520px;
  padding: 28px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
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

.op-empty-body code {
  font-family: var(--op-font-mono);
  font-size: 12px;
  background: var(--op-raise);
  padding: 1px 5px;
  border-radius: var(--op-radius-xs);
}
</style>
