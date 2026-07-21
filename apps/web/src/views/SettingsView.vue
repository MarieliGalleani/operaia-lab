<script setup lang="ts">
const rows = [
  { label: "Nome do escritório", value: "OperaIA.lab" },
  { label: "Fundadora", value: "Marieli" },
  { label: "Fonte de dados", value: "Mock local (pronto para API real)" },
  { label: "Funcionários ativos", value: "CEO — Opera, CTO — Mag" },
];
</script>

<template>
  <div class="page">
    <header>
      <h1 class="page__title">Configurações</h1>
      <p class="page__subtitle">Preferências do escritório virtual.</p>
    </header>

    <div class="card settings section">
      <div v-for="row in rows" :key="row.label" class="settings__row">
        <span class="settings__label">{{ row.label }}</span>
        <span class="settings__value">{{ row.value }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings {
  padding: 8px 22px;
  max-width: 640px;
}

.settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}

.settings__row:last-child {
  border-bottom: none;
}

.settings__label {
  font-size: 13.5px;
  color: var(--text-muted);
}

.settings__value {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
}
</style>
