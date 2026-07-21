<script setup lang="ts">
const docs = [
  { icon: "📄", title: "Visão do produto", desc: "Diretrizes e objetivos do OperaIA.lab." },
  { icon: "🏗️", title: "Arquitetura", desc: "Como os engines e funcionários se conectam." },
  { icon: "🗺️", title: "Roadmap", desc: "Próximas contratações e evoluções do escritório." },
];
</script>

<template>
  <div class="page">
    <header>
      <h1 class="page__title">Conhecimento</h1>
      <p class="page__subtitle">
        A base de conhecimento compartilhada da sua empresa digital.
      </p>
    </header>

    <div class="grid grid--cards section">
      <article v-for="doc in docs" :key="doc.title" class="card doc">
        <span class="doc__icon">{{ doc.icon }}</span>
        <h3 class="doc__title">{{ doc.title }}</h3>
        <p class="doc__desc">{{ doc.desc }}</p>
        <span class="doc__soon">Em preparação</span>
      </article>
    </div>
  </div>
</template>

<style scoped>
.doc {
  padding: 22px;
}

.doc__icon {
  font-size: 26px;
}

.doc__title {
  margin-top: 12px;
  font-size: 16px;
}

.doc__desc {
  margin-top: 6px;
  font-size: 13px;
}

.doc__soon {
  display: inline-block;
  margin-top: 14px;
  font-size: 11.5px;
  color: var(--text-soft);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 10px;
}
</style>
