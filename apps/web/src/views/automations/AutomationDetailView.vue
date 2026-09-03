<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import AutonomyBadge from "@/components/command/AutonomyBadge.vue";
import RiskBadge from "@/components/command/RiskBadge.vue";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { AUTOMATION_STATUS_LABEL, type AutomationDto } from "@/data/office-command";
import { officeCommandClient } from "@/data/adapters/office-client";

const props = defineProps<{ id: string }>();
const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
const id = props.id || String(route.params.id);

const detail = ref<AutomationDto | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");

onMounted(async () => {
  try {
    detail.value = await officeCommandClient.getAutomation(id);
    state.value = detail.value ? "ready" : "error";
  } catch (error) {
    console.log("[automation-detail] failed", error);
    state.value = "error";
  }
});
</script>

<template>
  <OperationalHeader
    :floor="floor"
    scope-line="Automações · Detalhe"
    :title="detail?.name ?? 'Automação'"
    lede="O que essa automação faz, quando roda e o histórico de execuções."
    :show-cta="false"
    :show-refresh="false"
  >
    <template #extra>
      <router-link to="/app/floor/automation/automations" class="op-btn">Voltar</router-link>
    </template>
  </OperationalHeader>
  <div class="op-content">
    <p v-if="state === 'loading'" class="op-loading">Carregando automação…</p>
    <div v-else-if="state === 'error'" class="op-error" role="alert">
      <p class="op-error__title">Automação não encontrada ou indisponível</p>
      <router-link to="/app/floor/automation/automations" class="op-btn">Voltar ao catálogo</router-link>
    </div>
    <section v-else-if="detail" class="op-det">
      <div class="op-det__ctx">
        <span class="op-status-chip">Cliente</span>
        <strong class="op-det__ctx-name">{{ detail.workspaceName }}</strong>
        <span class="op-status-chip op-status-chip--dot">{{ AUTOMATION_STATUS_LABEL[detail.status] }}</span>
      </div>

      <h2 class="op-det__heading">O que ela faz</h2>
      <p class="op-det__body">{{ detail.objective }}</p>

      <h2 class="op-det__heading">Quando usar</h2>
      <p class="op-det__copy">{{ detail.triggerLabel }}</p>

      <h2 class="op-det__heading">O que a OperaIA faria</h2>
      <ul class="op-det__list">
        <li v-for="a in detail.actions" :key="a">{{ a }}</li>
      </ul>

      <h2 class="op-det__heading">Estado atual</h2>
      <p class="op-det__copy">
        {{ AUTOMATION_STATUS_LABEL[detail.status] }} · A automação pertence a {{ detail.workspaceName }}.
      </p>
      <div class="op-det__badges">
        <RiskBadge :risk="detail.risk" />
        <AutonomyBadge :autonomy="detail.autonomy" />
      </div>
      <router-link to="/app/floor/dev/command/new" class="op-btn op-btn--cta">
        Descrever uma demanda
      </router-link>

      <h2 class="op-det__heading">Histórico</h2>
      <ul class="op-det__list">
        <li v-for="h in detail.history" :key="h.executionId">
          <router-link :to="`/app/floor/dev/executions/${h.executionId}`">
            {{ h.status }} · {{ new Date(h.at).toLocaleString("pt-BR") }}
          </router-link>
        </li>
        <li v-if="!detail.history.length" class="op-det__empty">Nenhuma execução registrada ainda.</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
}

.op-loading {
  color: var(--op-muted-4);
  font-size: 13px;
}

.op-error {
  max-width: 480px;
  padding: 24px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-error__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin-bottom: 14px;
}

.op-btn {
  padding: 9px 15px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  background: transparent;
  color: var(--op-muted);
  font-family: "Sora", sans-serif;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.op-btn:hover:not(:disabled) {
  border-color: var(--op-bd-btn-h);
  color: var(--op-ink-3);
  background: var(--op-raise);
}

.op-btn--cta {
  border-color: var(--op-cta);
  background: var(--op-cta);
  color: #fff;
  font-weight: 600;
}

.op-btn--cta:hover:not(:disabled) {
  background: var(--op-cta-h);
  border-color: var(--op-cta-h);
}

.op-det {
  max-width: 720px;
  padding: 24px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-det__ctx {
  display: flex;
  align-items: center;
  gap: 10px;
}

.op-det__ctx-name {
  font-size: 14px;
  color: var(--op-ink-2);
}

.op-status-chip {
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: var(--op-radius-xs);
  background: var(--op-raise);
  color: var(--op-muted-2);
}

.op-status-chip--dot {
  margin-left: auto;
}

.op-det__heading {
  margin-top: 22px;
  font-size: 14px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-det__body {
  margin-top: 10px;
  font-size: 13.5px;
  color: var(--op-ink-3);
}

.op-det__copy {
  margin-top: 8px;
  font-size: 13px;
  color: var(--op-muted-3);
}

.op-det__list {
  margin: 10px 0 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--op-muted-3);
}

.op-det__list li + li {
  margin-top: 6px;
}

.op-det__list a {
  color: var(--op-cta);
}

.op-det__empty {
  list-style: none;
  margin-left: -20px;
  color: var(--op-muted-5);
}

.op-det__badges {
  display: flex;
  gap: 8px;
  margin: 12px 0 20px;
}
</style>
