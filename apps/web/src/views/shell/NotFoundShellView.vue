<script setup lang="ts">
import { useRoute } from "vue-router";

const route = useRoute();
</script>

<template>
  <div class="nf">
    <div class="nf__card">
      <p class="nf__eyebrow">ENDEREÇO NÃO ENCONTRADO</p>
      <h1 class="nf__title">Esta página não existe</h1>
      <p class="nf__body">
        <code>{{ route.fullPath }}</code> não leva a nenhuma sala do escritório. Pode ser um link antigo.
      </p>
      <div class="nf__actions">
        <router-link to="/app/portaria" class="nf__btn nf__btn--primary">Ir para a Portaria</router-link>
        <router-link to="/app/portaria/sala-opera" class="nf__btn">Falar com a Opera</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nf {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 48px var(--op-gutter, 34px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  font-family: "Sora", sans-serif;
}

.nf__card {
  max-width: 520px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 28px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.nf__eyebrow {
  margin: 0;
  font-family: var(--op-font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--op-muted-3);
}

.nf__title {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  color: var(--op-ink);
}

.nf__body {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--op-muted-2);
  overflow-wrap: anywhere;
}

.nf__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
}

.nf__btn {
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  color: var(--op-ink-3);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.nf__btn--primary {
  border-color: transparent;
  background: var(--op-cta);
  color: #fff;
  font-weight: 600;
}
</style>
