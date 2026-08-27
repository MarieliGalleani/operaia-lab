<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AutomationCard from "@/components/command/AutomationCard.vue";
import EmptyState from "@/components/command/EmptyState.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import PreparationAutomationCard from "@/components/command/PreparationAutomationCard.vue";
import { officeCommandClient } from "@/data/adapters/office-client";
import { PREPARATION_AUTOMATIONS } from "@/data/automation-capabilities";
import type { AutomationListItem, AutomationStatus } from "@/data/office-command";

const items = ref<readonly AutomationListItem[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");

const available = computed(() =>
  items.value.filter((item) => item.status === "READY" || item.status === "ACTIVE"),
);
const running = computed(() =>
  items.value.filter(
    (item) => item.status === "RUNNING" || item.status === "VALIDATING",
  ),
);
const attention = computed(() =>
  items.value.filter(
    (item) => item.status === "PAUSED" || item.status === "FAILED",
  ),
);
const other = computed(() =>
  items.value.filter((item) =>
    (["DRAFT", "PLANNED", "ARCHIVED"] as AutomationStatus[]).includes(item.status),
  ),
);

async function loadAutomations(): Promise<void> {
  state.value = "loading";
  try {
    items.value = await officeCommandClient.listAutomations();
    state.value = "ready";
  } catch (error) {
    console.log("[automations] failed", error);
    state.value = "error";
  }
}

onMounted(loadAutomations);
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Trabalho › Automações</p>
        <h1 class="page__title">O que a OperaIA pode automatizar?</h1>
      </div>
      <router-link to="/app/command/new" class="btn btn--primary">Nova demanda</router-link>
    </header>
    <div class="studio__stage automations">
      <LoadingState v-if="state === 'loading'" label="Carregando catálogo de automações" />
      <section v-else-if="state === 'error'" class="panel automations__state" role="alert">
        <h2>Catálogo indisponível</h2>
        <p>Não foi possível consultar as automações registradas no escritório.</p>
        <button type="button" class="btn btn--primary" @click="loadAutomations">
          Tentar de novo
        </button>
      </section>
      <template v-else>
        <section class="automations__intro panel">
          <p class="eyebrow">Capacidades do escritório</p>
          <p>Automatizações registradas aparecem com seu estado real. Capacidades em preparação não iniciam execuções.</p>
        </section>

        <section class="section" aria-labelledby="preparation-title">
          <div class="section__head">
            <div>
              <p class="eyebrow">Em preparação</p>
              <h2 id="preparation-title" class="section__title">Capacidades que estão sendo construídas</h2>
            </div>
          </div>
          <div class="automations__grid">
            <PreparationAutomationCard
              v-for="item in PREPARATION_AUTOMATIONS"
              :key="item.id"
              :automation="item"
            />
          </div>
        </section>

        <section v-if="available.length" class="section" aria-labelledby="available-title">
          <div class="section__head">
            <h2 id="available-title" class="section__title">Disponíveis</h2>
          </div>
          <div class="automations__grid">
            <AutomationCard v-for="item in available" :key="item.id" :item="item" />
          </div>
        </section>

        <section v-if="running.length" class="section" aria-labelledby="running-title">
          <div class="section__head">
            <h2 id="running-title" class="section__title">Em execução</h2>
          </div>
          <div class="automations__grid">
            <AutomationCard v-for="item in running" :key="item.id" :item="item" />
          </div>
        </section>

        <section v-if="attention.length" class="section" aria-labelledby="attention-title">
          <div class="section__head">
            <h2 id="attention-title" class="section__title">Precisam de atenção</h2>
          </div>
          <div class="automations__grid">
            <AutomationCard v-for="item in attention" :key="item.id" :item="item" />
          </div>
        </section>

        <section v-if="other.length" class="section" aria-labelledby="other-title">
          <div class="section__head">
            <h2 id="other-title" class="section__title">Outros estados</h2>
          </div>
          <div class="automations__grid">
            <AutomationCard v-for="item in other" :key="item.id" :item="item" />
          </div>
        </section>

        <EmptyState
          v-if="!items.length"
          title="Nenhuma automação registrada ainda"
          body="As capacidades em preparação acima ainda não possuem execução operacional."
          cta-label="Nova demanda"
          cta-to="/app/command/new"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.automations__intro {
  padding: 18px;
  margin-bottom: var(--space-4);
}

.automations__intro p:last-child {
  margin-top: 8px;
  color: var(--text-muted);
}

.automations__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.automations__grid > * {
  margin-right: 12px;
  margin-bottom: 12px;
}

.automations__state {
  padding: 20px;
}

.automations__state p {
  margin: 8px 0 16px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .automations__grid {
    grid-template-columns: 1fr;
  }
}
</style>
