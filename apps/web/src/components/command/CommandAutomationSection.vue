<script setup lang="ts">
import AutomationCard from "@/components/command/AutomationCard.vue";
import PreparationAutomationCard from "@/components/command/PreparationAutomationCard.vue";
import { PREPARATION_AUTOMATIONS } from "@/data/automation-capabilities";
import type { AutomationListItem } from "@/data/office-command";

defineProps<{
  automations: readonly AutomationListItem[];
  state: "idle" | "loading" | "ready" | "error";
}>();
</script>

<template>
  <section id="cc-automations" class="section" aria-labelledby="cc-automations-title">
    <div class="section__head">
      <div>
        <p class="eyebrow">Capacidades do escritório</p>
        <h2 id="cc-automations-title" class="section__title">Automações</h2>
        <p class="section-copy">Capacidades que podem assumir trabalho recorrente.</p>
      </div>
      <router-link to="/app/automations" class="section__link">Ver catálogo</router-link>
    </div>
    <div v-if="automations.length" class="automation-grid">
      <AutomationCard
        v-for="item in automations.slice(0, 2)"
        :key="item.id"
        :item="item"
      />
    </div>
    <div class="automation-grid">
      <PreparationAutomationCard
        v-for="item in PREPARATION_AUTOMATIONS"
        :key="item.id"
        :automation="item"
      />
    </div>
    <p v-if="state === 'error'" class="quiet" role="status">
      O catálogo operacional não está disponível agora. As capacidades em preparação continuam visíveis.
    </p>
  </section>
</template>

<style scoped>
.section-copy {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.automation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 14px;
}

.automation-grid > * {
  margin-right: 12px;
  margin-bottom: 12px;
}

.quiet {
  color: var(--text-soft);
  font-size: var(--text-sm);
}

@media (max-width: 768px) {
  .automation-grid {
    grid-template-columns: 1fr;
  }
}
</style>
