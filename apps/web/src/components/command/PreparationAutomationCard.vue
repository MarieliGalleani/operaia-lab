<script setup lang="ts">
import { ref } from "vue";
import type { PreparationAutomation } from "@/data/automation-capabilities";

defineProps<{ automation: PreparationAutomation }>();

const requestOpened = ref(false);
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

    <button type="button" class="btn btn--ghost capability__action" @click="requestOpened = true">
      Solicitar
    </button>

    <p v-if="requestOpened" class="capability__notice" role="status">
      Solicitação ainda não disponível. Esta capacidade está sendo preparada pela equipe digital;
      nenhuma execução foi iniciada.
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

.capability__action {
  margin-top: 16px;
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

  .capability__action {
    width: 100%;
  }
}
</style>
