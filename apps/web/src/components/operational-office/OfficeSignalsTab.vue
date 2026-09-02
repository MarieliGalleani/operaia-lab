<script setup lang="ts">
/**
 * Aba Sinais (P1.19) — nao implementada nesta rodada.
 *
 * Nao existe GET de listagem de DomainSignal em lugar nenhum do backend
 * (so ha POST de ingestao de webhook), e o enum real de decisao
 * (DomainSignalEvaluationDecision) so tem 3 valores — o design pede 5
 * ("reutilizar"/"evitar" nao existem) e um nivel S1-S4 que tambem nao
 * existe no model. Implementar de verdade exigiria endpoint novo e
 * possivelmente migration — fora do escopo aditivo-sem-schema desta
 * rodada (auditoria P1.19, achado critico #3).
 */
</script>

<template>
  <div class="oo-signals-empty">
    <p class="oo-signals-empty__title">Sinais ainda não tem uma tela própria</p>
    <p class="oo-signals-empty__body">
      O escritório já captura sinais (GitHub, webhooks) e decide sobre eles
      internamente, mas não existe hoje um endpoint de leitura para listar
      esses sinais — só a ingestão. Construir esta aba de verdade exige um
      endpoint novo (e possivelmente ajustar o modelo de decisão, que hoje
      só suporta 3 valores, não os 5 que esta tela pediria). Fica reservado
      para uma rodada própria, com gate de schema se necessário.
    </p>
  </div>
</template>

<style scoped>
.oo-signals-empty {
  max-width: 480px;
  padding: 32px 4px;
}

.oo-signals-empty__title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 8px;
}

.oo-signals-empty__body {
  font-size: 13px;
  color: var(--oo-muted);
  line-height: 1.6;
}
</style>
