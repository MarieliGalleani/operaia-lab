<script setup lang="ts">
import type { Employee } from "@/types/office";

defineProps<{ employees: readonly Employee[] }>();
</script>

<template>
  <section class="section" aria-labelledby="cc-team">
    <div class="section__head">
      <div>
        <p class="eyebrow">Equipe digital</p>
        <h2 id="cc-team" class="section__title">Quem está no escritório</h2>
      </div>
      <router-link to="/app/team" class="section__link">Ver equipe</router-link>
    </div>
    <div v-if="employees.length" class="team">
      <article v-for="employee in employees" :key="employee.id" class="person panel">
        <span class="person__avatar">{{ employee.emoji }}</span>
        <div>
          <strong>{{ employee.name }}</strong>
          <span>{{ employee.specialtyLabel }}</span>
          <small>{{ employee.statusLabel }}</small>
        </div>
      </article>
    </div>
    <p v-else class="quiet">A equipe ainda não está disponível para consulta.</p>
  </section>
</template>

<style scoped>
.team {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 14px;
}

.person {
  display: flex;
  align-items: center;
  padding: 14px;
  margin-right: 12px;
  margin-bottom: 12px;
}

.person__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  margin-right: 10px;
  border-radius: 50%;
  background: var(--surface-2);
  font-size: 20px;
}

.person strong,
.person span,
.person small {
  display: block;
}

.person span,
.person small {
  margin-top: 3px;
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.quiet {
  color: var(--text-soft);
  font-size: var(--text-sm);
}

@media (max-width: 980px) {
  .team {
    grid-template-columns: 1fr;
  }
}
</style>
