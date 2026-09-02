<script setup lang="ts">
/**
 * Aba Hoje (P1.19). GET /office/status e andar-agnostico — nao existe
 * agregacao por floor no backend (auditoria P1.19, achado critico #2).
 * Por isso esta aba mostra o estado real do ESCRITORIO INTEIRO, rotulado
 * honestamente como tal, em vez de fingir um recorte por andar que os
 * dados nao sustentam.
 *
 * "Precisa de voce": humanAction.proposals tem id real de ChangeProposal
 * e leva para a tela de Aprovacoes existente — nao ha um botao local de
 * "Resolvido" que remove o item so na UI, porque isso mascararia o
 * estado real (o item reapareceria no proximo refresh de verdade).
 */
import { computed } from "vue";
import type { OfficeStatusDto } from "@/data/adapters/office-status-client";

const props = defineProps<{
  status: OfficeStatusDto | null;
  loading: boolean;
}>();

const levelLabel = computed(() => {
  switch (props.status?.status.level) {
    case "OPERATING":
      return { text: "Operando", tone: "ok" };
    case "ATTENTION":
      return { text: "Atenção", tone: "warn" };
    case "PROBLEM":
      return { text: "Problema", tone: "bad" };
    default:
      return { text: "—", tone: "ok" };
  }
});
</script>

<template>
  <div class="oo-today">
    <p v-if="loading && !status" class="oo-loading">Carregando status do escritório…</p>
    <template v-else-if="status">
      <section class="oo-card oo-rise oo-strip">
        <div class="oo-strip__answer">
          <p class="oo-eyebrow" :class="`is-${levelLabel.tone}`">{{ levelLabel.text }}</p>
          <h2>{{ status.status.summary }}</h2>
          <p class="oo-strip__body">{{ status.activity.message }}</p>
          <div class="oo-pulse-row">
            <div class="oo-pulse-item">
              <p class="oo-mono oo-pulse-value">{{ status.status.workers.alive }}</p>
              <p class="oo-pulse-label">workers vivos</p>
            </div>
            <div class="oo-pulse-item">
              <p class="oo-mono oo-pulse-value">{{ status.status.queue.running }}</p>
              <p class="oo-pulse-label">em execução</p>
            </div>
            <div class="oo-pulse-item">
              <p class="oo-mono oo-pulse-value">{{ status.status.queue.queued }}</p>
              <p class="oo-pulse-label">na fila</p>
            </div>
            <div class="oo-pulse-item">
              <p class="oo-mono oo-pulse-value">{{ status.attention.failed.newInWindow }}</p>
              <p class="oo-pulse-label">falhas 24h</p>
            </div>
          </div>
        </div>
        <div class="oo-strip__asks">
          <p class="oo-eyebrow">Precisa de você</p>
          <ul v-if="status.humanAction.proposals.length > 0" class="oo-ask-list">
            <li v-for="p in status.humanAction.proposals" :key="p.id" class="oo-ask">
              <span class="oo-ask__title">{{ p.title }}</span>
              <span class="oo-ask__badge">{{ p.status }}</span>
              <router-link
                :to="`/app/floor/dev/command/approvals/${p.id}`"
                class="oo-btn oo-btn--sm"
              >
                Investigar
              </router-link>
            </li>
          </ul>
          <p v-else class="oo-ask-empty">{{ status.humanAction.message }}</p>
        </div>
      </section>

      <section class="oo-card oo-rise">
        <header class="oo-section-head">
          <p class="oo-eyebrow">Acontecendo agora</p>
        </header>
        <ul v-if="status.activity.runningObjectives.length > 0" class="oo-running-list">
          <li v-for="m in status.activity.runningObjectives" :key="m.id" class="oo-running">
            <router-link :to="`/app/floor/dev/missions/${m.id}`">{{ m.objective }}</router-link>
          </li>
        </ul>
        <p v-else class="oo-empty">Nenhuma missão em execução agora.</p>
      </section>

      <div class="oo-two-col">
        <section class="oo-card oo-rise">
          <p class="oo-eyebrow">Entregue recentemente</p>
          <ul v-if="status.completed.items.length > 0" class="oo-delivered-list">
            <li v-for="c in status.completed.items" :key="c.id" class="oo-delivered">
              <span class="oo-dot oo-dot--ok" />
              <span>{{ c.title }}</span>
            </li>
          </ul>
          <p v-else class="oo-empty">{{ status.completed.emptyMessage }}</p>
        </section>
        <section class="oo-card oo-rise">
          <p class="oo-eyebrow">Governança · janela 24h</p>
          <div class="oo-gov-grid">
            <div class="oo-gov-item">
              <p class="oo-mono">{{ status.governance.gate.execute }}</p>
              <span>Autorizado</span>
            </div>
            <div class="oo-gov-item">
              <p class="oo-mono">{{ status.governance.gate.reuse }}</p>
              <span>Reaproveitado</span>
            </div>
            <div class="oo-gov-item">
              <p class="oo-mono">{{ status.governance.gate.skip }}</p>
              <span>Evitado</span>
            </div>
            <div class="oo-gov-item">
              <p class="oo-mono">{{ status.governance.gate.reopen }}</p>
              <span>Reaberto</span>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.oo-loading,
.oo-empty {
  color: var(--oo-muted-3);
  font-size: 13px;
  padding: 8px 2px;
}

.oo-strip {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 1px;
  background: var(--oo-line);
  padding: 0;
  overflow: hidden;
}

.oo-strip__answer,
.oo-strip__asks {
  background: var(--oo-panel);
  padding: 20px;
}

.oo-strip__answer h2 {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 6px 0 8px;
}

.oo-strip__body {
  font-size: 13.5px;
  color: var(--oo-muted);
  margin-bottom: 16px;
}

.oo-eyebrow.is-ok {
  color: var(--oo-green);
}
.oo-eyebrow.is-warn {
  color: var(--oo-amber);
}
.oo-eyebrow.is-bad {
  color: var(--oo-red);
}

.oo-pulse-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--oo-line-soft);
}

.oo-pulse-value {
  font-size: 20px;
  font-weight: 600;
}

.oo-pulse-label {
  font-size: 10.5px;
  color: var(--oo-muted-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.oo-ask-list {
  list-style: none;
  margin-top: 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.oo-ask {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--oo-line);
  font-size: 12.5px;
}

.oo-ask__badge {
  align-self: flex-start;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--oo-dash);
  color: var(--oo-muted-2);
}

.oo-ask-empty {
  margin-top: 12px;
  font-size: 13px;
  color: var(--oo-muted-3);
}

.oo-btn--sm {
  padding: 5px 10px;
  font-size: 11.5px;
  align-self: flex-start;
  text-decoration: none;
}

.oo-section-head {
  margin-bottom: 12px;
}

.oo-running-list,
.oo-delivered-list {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oo-running a {
  color: var(--oo-ink);
  text-decoration: none;
  font-size: 13px;
}

.oo-running a:hover {
  color: var(--oo-cta);
}

.oo-delivered {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.oo-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.oo-two-col .oo-card {
  padding: 18px;
}

.oo-gov-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.oo-gov-item {
  text-align: center;
  padding: 10px 4px;
  border-radius: 8px;
  background: var(--oo-raise);
}

.oo-gov-item p {
  font-size: 18px;
  font-weight: 600;
}

.oo-gov-item span {
  font-size: 10px;
  color: var(--oo-muted-3);
  text-transform: uppercase;
}

section.oo-card {
  padding: 18px;
  margin-top: 14px;
}

section.oo-card:first-of-type {
  margin-top: 0;
}

@media (max-width: 900px) {
  .oo-strip,
  .oo-two-col {
    grid-template-columns: 1fr;
  }
}
</style>
