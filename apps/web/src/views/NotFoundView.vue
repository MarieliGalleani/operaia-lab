<script setup lang="ts">
/**
 * Rota reconhecida mas sem capacidade real por trás (P1.14A / Parte H).
 * Nunca renderizar tela branca silenciosa — sempre uma resposta explícita.
 */
import { useRoute } from "vue-router";

const route = useRoute();
</script>

<template>
  <div class="studio">
    <div class="studio__stage not-found">
      <section class="panel not-found__card">
        <p class="eyebrow">Não encontrado</p>
        <h1>Esta página ainda não existe</h1>
        <p class="not-found__body">
          <code>{{ route.fullPath }}</code> não corresponde a nenhuma
          funcionalidade real da OperaIA.lab hoje.
        </p>
        <router-link to="/app/floor/dev/command" class="btn btn--primary">
          Voltar ao Command Center
        </router-link>
      </section>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
.not-found__card {
  padding: 28px;
  max-width: 420px;
  text-align: center;
}
.not-found__card h1 {
  margin-top: 6px;
  font-size: var(--text-lg);
  font-weight: 700;
}
.not-found__body {
  margin-top: 12px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.not-found__body code {
  font-family: ui-monospace, monospace;
  color: var(--text-soft);
}
.not-found .btn {
  margin-top: 18px;
}
</style>
