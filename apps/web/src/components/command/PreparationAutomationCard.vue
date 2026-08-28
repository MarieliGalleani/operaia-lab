<script setup lang="ts">
import type { PreparationAutomation } from "@/data/automation-capabilities";

defineProps<{ automation: PreparationAutomation }>();
</script>

<template>
  <article class="capability panel">
    <header class="capability__head">
      <div>
        <p class="eyebrow">Capacidade em preparação</p>
        <h3 class="capability__title">{{ automation.name }}</h3>
      </div>
      <span class="badge badge--planned">Em preparação</span>
    </header>

    <p class="capability__description">{{ automation.description }}</p>

    <dl class="capability__details">
      <div>
        <dt>Quando usar</dt>
        <dd>{{ automation.whenToUse }}</dd>
      </div>
      <div>
        <dt>O que a OperaIA faria</dt>
        <dd>{{ automation.proposedActions.join(" · ") }}</dd>
      </div>
    </dl>

    <p class="capability__notice" role="status">
      Ainda não pode ser solicitada. Nenhuma execução foi iniciada.
    </p>
  </article>
</template>

<style scoped>
.capability {
  padding: 18px;
  height: 100%;
}

.capability__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.capability__title {
  margin-top: 6px;
  font-size: var(--text-lg);
}

.capability__description {
  margin-top: 12px;
  color: var(--text);
  font-size: var(--text-sm);
}

.capability__details {
  margin: 16px 0 0;
}

.capability__details > div {
  padding: 10px 0;
  border-top: 1px solid var(--border);
}

.capability__details dt {
  font-size: var(--text-xs);
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.capability__details dd {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.capability__notice {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--text-xs);
}

@media (max-width: 768px) {
  .capability__head {
    flex-direction: column;
  }

  .capability__head .badge {
    margin-top: 10px;
  }
}
</style>
