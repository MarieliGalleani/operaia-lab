<script setup lang="ts">
</script>

<template>
  <section class="actions panel" aria-labelledby="cc-actions">
    <div class="section__head">
      <div>
        <p class="eyebrow">Comece por aqui</p>
        <h2 id="cc-actions" class="section__title">O que você quer fazer?</h2>
      </div>
    </div>
    <div class="actions__grid">
      <router-link to="/app/command/new" class="actions__item actions__item--primary">
        <strong>Nova demanda</strong>
        <span>Descreva o trabalho que você precisa realizar.</span>
      </router-link>
      <a href="#cc-automations" class="actions__item">
        <strong>Solicitar automação</strong>
        <span>Conheça as capacidades que estão sendo preparadas.</span>
      </a>
      <router-link to="/app/missions" class="actions__item">
        <strong>Ver meu trabalho</strong>
        <span>Acompanhe missões, resultados e próximos passos.</span>
      </router-link>
      <router-link to="/app/decisions" class="actions__item">
        <strong>Revisar decisões</strong>
        <span>Veja o que precisa da sua análise.</span>
      </router-link>
    </div>
  </section>
</template>

<style scoped>
.actions {
  padding: 20px;
  margin-bottom: var(--space-4);
}

.actions__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 14px;
}

.actions__item {
  display: block;
  padding: 16px;
  margin-right: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: inherit;
  background: var(--surface-2);
  transition: border-color 160ms ease, background 160ms ease;
}

.actions__item:hover,
.actions__item:focus-visible,
.actions__item--primary {
  border-color: var(--brand-line);
  background: var(--brand-soft);
}

.actions__item strong,
.actions__item span {
  display: block;
}

.actions__item span {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

@media (max-width: 768px) {
  .actions__grid {
    grid-template-columns: 1fr;
  }
}
</style>
