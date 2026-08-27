<script setup lang="ts">
import { onMounted, ref } from "vue";
import EmptyState from "@/components/command/EmptyState.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { ExecutionListItem } from "@/data/office-command";

const items = ref<readonly ExecutionListItem[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");

const statusLabel: Record<ExecutionListItem["status"], string> = {
  PENDING: "Aguardando",
  RUNNING: "Em execução",
  WAITING_APPROVAL: "Aguardando sua aprovação",
  SUCCESS: "Concluída",
  FAILED: "Com falha",
  CANCELLED: "Cancelada",
};

async function loadExecutions(): Promise<void> {
  state.value = "loading";
  try {
    items.value = await officeCommandClient.listExecutions();
    state.value = "ready";
  } catch (error) {
    console.log("[executions] failed", error);
    state.value = "error";
  }
}

onMounted(loadExecutions);
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Sistema › Histórico</p>
        <h1 class="page__title">Solicitação até resultado</h1>
      </div>
    </header>
    <div class="studio__stage">
      <LoadingState v-if="state === 'loading'" />
      <section v-else-if="state === 'error'" class="panel exec__error" role="alert">
        <p>Não foi possível carregar o histórico de execuções.</p>
        <button type="button" class="btn btn--primary" @click="loadExecutions">
          Tentar de novo
        </button>
      </section>
      <template v-else>
        <router-link
          v-for="item in items"
          :key="item.id"
          :to="`/app/executions/${item.id}`"
          class="panel exec card--lift"
        >
          <div class="exec__head">
            <div>
              <p class="eyebrow">{{ item.workspaceName }}</p>
              <h3>{{ item.automationName }}</h3>
            </div>
            <span class="badge badge--dot">{{ statusLabel[item.status] }}</span>
          </div>
          <ol class="exec__flow" aria-label="Fluxo da execução">
            <li><span>1</span> Solicitação</li>
            <li><span>2</span> Missão</li>
            <li><span>3</span> Execução</li>
            <li><span>4</span> Resultado</li>
          </ol>
          <p class="exec__date">
            Iniciada em {{ new Date(item.startedAt).toLocaleString("pt-BR") }}
          </p>
        </router-link>
        <EmptyState
          v-if="!items.length"
          title="Nenhuma execução"
          body="Quando uma automação rodar, o rastro aparece aqui."
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.exec {
  display: block;
  padding: 16px 18px;
  color: inherit;
  margin-bottom: 12px;
}
.exec__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.exec h3 {
  margin-top: 6px;
  font-size: var(--text-md);
}
.exec__flow {
  display: flex;
  flex-wrap: wrap;
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
}
.exec__flow li {
  display: flex;
  align-items: center;
  margin: 0 16px 8px 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
}
.exec__flow span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-right: 6px;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  color: var(--text);
}
.exec__date {
  color: var(--text-soft);
}
.exec__error {
  padding: 18px;
}
.exec__error .btn {
  margin-top: 12px;
}
.exec p {
  margin-top: 6px;
  font-size: var(--text-sm);
}
</style>
