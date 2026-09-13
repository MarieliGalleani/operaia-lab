<script setup lang="ts">
/** Fase 5 — O Mural do Escritório: migra pro sistema visual atual (--op-*). */
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { scheduleRulesClient } from "@/data/adapters/schedule-rules-client";
import type { ScheduleRuleDto } from "@/data/schedule-rules";

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));

const rules = ref<readonly ScheduleRuleDto[]>([]);
const state = ref<"idle" | "loading" | "ready" | "error">("idle");
const errorMessage = ref("");

const workspaceId = ref("operaia-lab");
const objective = ref("");
const intervalMin = ref(30);
const submitting = ref(false);
const submitError = ref("");

async function load(): Promise<void> {
  state.value = "loading";
  try {
    rules.value = await scheduleRulesClient.list();
    state.value = "ready";
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Falha ao carregar gatilhos.";
    state.value = "error";
  }
}

onMounted(load);

const canSubmit = computed(
  () => objective.value.trim().length > 0 && intervalMin.value >= 1,
);

async function createRule(): Promise<void> {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  submitError.value = "";
  try {
    await scheduleRulesClient.create({
      workspaceId: workspaceId.value.trim(),
      objective: objective.value.trim(),
      intervalSec: Math.round(intervalMin.value * 60),
    });
    objective.value = "";
    await load();
  } catch (error) {
    submitError.value =
      error instanceof Error ? error.message : "Falha ao criar gatilho.";
  } finally {
    submitting.value = false;
  }
}

async function toggleEnabled(rule: ScheduleRuleDto): Promise<void> {
  try {
    await scheduleRulesClient.update(rule.id, { enabled: !rule.enabled });
    await load();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Falha ao atualizar gatilho.";
  }
}

async function removeRule(rule: ScheduleRuleDto): Promise<void> {
  try {
    await scheduleRulesClient.remove(rule.id);
    await load();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Falha ao remover gatilho.";
  }
}

function intervalLabel(sec: number): string {
  if (sec % 3600 === 0) {
    const h = sec / 3600;
    return `a cada ${h}h`;
  }
  const min = Math.round(sec / 60);
  return `a cada ${min} min`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "nunca disparou";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
</script>

<template>
  <OperationalHeader
    :floor="floor"
    scope-line="Automação · Gatilhos"
    title="Gatilhos automáticos"
    lede="A cada intervalo, o escritório dispara uma missão sozinho — sem você precisar pedir."
    :show-cta="false"
    :refreshing="state === 'loading'"
    @refresh="load"
  />
  <div class="op-content">
    <section class="op-panel op-form-card">
      <p class="op-eyebrow-sm">Novo gatilho</p>
      <h2 class="op-panel__title">Fazer o escritório trabalhar sozinho</h2>
      <p class="op-hint">
        A cada intervalo definido, o escritório dispara uma missão de
        coordenação com o objetivo abaixo.
      </p>

      <form class="op-form" @submit.prevent="createRule">
        <label class="op-field">
          <span>Workspace</span>
          <input v-model="workspaceId" type="text" class="op-input" placeholder="operaia-lab" />
          <small>ex: operaia-lab, nexo, infra, deploy</small>
        </label>

        <label class="op-field">
          <span>Objetivo</span>
          <textarea
            v-model="objective"
            class="op-textarea"
            rows="2"
            placeholder="Ex: revisar pendências e reportar o que precisa de atenção"
          />
        </label>

        <label class="op-field op-field--narrow">
          <span>Intervalo (minutos)</span>
          <input v-model.number="intervalMin" type="number" class="op-input" min="1" max="1440" />
        </label>

        <p v-if="submitError" class="op-error-inline">{{ submitError }}</p>

        <button type="submit" class="op-btn op-btn--cta" :disabled="!canSubmit || submitting">
          {{ submitting ? "Criando…" : "Criar gatilho" }}
        </button>
      </form>
    </section>

    <p v-if="state === 'loading' && !rules.length" class="op-loading">Carregando gatilhos…</p>

    <div v-else-if="state === 'error' && !rules.length" class="op-error" role="alert">
      <p class="op-error__title">Não consegui carregar</p>
      <p class="op-error__body">{{ errorMessage }}</p>
      <button type="button" class="op-btn-retry" @click="load">Tentar de novo</button>
    </div>

    <section v-else class="op-rules">
      <p v-if="!rules.length" class="op-empty-inline">Nenhum gatilho cadastrado ainda — crie um acima.</p>
      <article v-for="rule in rules" :key="rule.id" class="op-rule">
        <div class="op-rule__main">
          <p class="op-rule__objective">{{ rule.objective ?? "(sem objetivo)" }}</p>
          <p class="op-rule__meta">
            {{ rule.workspaceName ?? rule.workspaceId ?? "sem workspace" }}
            · {{ intervalLabel(rule.intervalSec) }}
            · última execução: {{ formatWhen(rule.lastEnqueuedAt) }}
          </p>
        </div>
        <div class="op-rule__actions">
          <button type="button" class="op-btn" @click="toggleEnabled(rule)">
            {{ rule.enabled ? "Pausar" : "Ativar" }}
          </button>
          <button type="button" class="op-btn op-btn--danger" @click="removeRule(rule)">Remover</button>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.op-panel {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  padding: 20px;
}

.op-panel__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin-top: 4px;
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-hint {
  margin: 8px 0 16px;
  font-size: 12.5px;
  color: var(--op-muted-3);
}

.op-form {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: flex-end;
}

.op-field {
  display: flex;
  flex-direction: column;
  flex: 1 1 260px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--op-muted-4);
}

.op-field--narrow {
  flex: 0 1 160px;
}

.op-input,
.op-textarea {
  margin-top: 8px;
  width: 100%;
  background: var(--op-raise);
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  padding: 10px 12px;
  font-size: 13px;
  color: var(--op-ink-2);
  font-family: inherit;
  text-transform: none;
  letter-spacing: normal;
  font-weight: 400;
}

.op-input:focus,
.op-textarea:focus {
  outline: none;
  border-color: var(--op-cta);
}

.op-field small {
  margin-top: 4px;
  color: var(--op-muted-5);
  text-transform: none;
  letter-spacing: normal;
  font-weight: 400;
}

.op-error-inline {
  flex-basis: 100%;
  color: var(--op-red);
  font-size: 12px;
}

.op-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-raise);
  color: var(--op-ink-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.op-btn:hover:not(:disabled) {
  border-color: var(--op-bd-btn-h);
}

.op-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.op-btn--cta {
  background: var(--op-cta);
  border-color: var(--op-cta);
  color: #fff;
}

.op-btn--cta:hover:not(:disabled) {
  background: var(--op-cta-h);
}

.op-btn--danger {
  color: var(--op-red);
}

.op-btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--op-red) 14%, transparent);
  border-color: var(--op-red);
}

.op-loading,
.op-empty-inline {
  font-size: 13px;
  color: var(--op-muted-3);
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
  margin-bottom: 6px;
}

.op-error__body {
  font-size: 12.5px;
  color: var(--op-muted-3);
  margin-bottom: 14px;
}

.op-btn-retry {
  padding: 8px 14px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-raise);
  color: var(--op-ink-2);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.op-rules {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.op-rule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-rule__objective {
  font-weight: 600;
  font-size: 13.5px;
  color: var(--op-ink-2);
}

.op-rule__meta {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--op-muted-3);
}

.op-rule__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

@media (max-width: 720px) {
  .op-rule {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
