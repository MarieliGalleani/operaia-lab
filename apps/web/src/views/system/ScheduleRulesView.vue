<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { scheduleRulesClient } from "@/data/adapters/schedule-rules-client";
import type { ScheduleRuleDto } from "@/data/schedule-rules";

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
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Sistema</p>
        <h1 class="page__title">Gatilhos automáticos</h1>
      </div>
      <div class="topbar__right">
        <router-link to="/app/command" class="btn btn--ghost">
          Command Center
        </router-link>
      </div>
    </header>

    <div class="studio__stage">
      <section class="panel form-card">
        <p class="eyebrow">Novo gatilho</p>
        <h2 class="section__title">Fazer o escritório trabalhar sozinho</h2>
        <p class="hint">
          A cada intervalo definido, o escritório dispara uma missão de
          coordenação com o objetivo abaixo — sem você precisar pedir.
        </p>

        <form class="form" @submit.prevent="createRule">
          <label class="field">
            <span>Workspace</span>
            <input v-model="workspaceId" type="text" placeholder="operaia-lab" />
            <small>ex: operaia-lab, nexo, infra, deploy</small>
          </label>

          <label class="field">
            <span>Objetivo</span>
            <textarea
              v-model="objective"
              rows="2"
              placeholder="Ex: revisar pendências e reportar o que precisa de atenção"
            />
          </label>

          <label class="field field--narrow">
            <span>Intervalo (minutos)</span>
            <input v-model.number="intervalMin" type="number" min="1" max="1440" />
          </label>

          <p v-if="submitError" class="form-error">{{ submitError }}</p>

          <button
            type="submit"
            class="btn btn--primary"
            :disabled="!canSubmit || submitting"
          >
            {{ submitting ? "Criando..." : "Criar gatilho" }}
          </button>
        </form>
      </section>

      <LoadingState v-if="state === 'loading' && !rules.length" label="Carregando gatilhos" />

      <div v-else-if="state === 'error' && !rules.length" class="panel" role="alert">
        <p class="empty-state__title">Não consegui carregar</p>
        <p>{{ errorMessage }}</p>
        <button type="button" class="btn btn--primary" @click="load">Tentar de novo</button>
      </div>

      <section v-else class="rules">
        <p v-if="!rules.length" class="quiet">
          Nenhum gatilho cadastrado ainda — crie um acima.
        </p>
        <article v-for="rule in rules" :key="rule.id" class="panel rule">
          <div class="rule__main">
            <p class="rule__objective">{{ rule.objective ?? "(sem objetivo)" }}</p>
            <p class="rule__meta">
              {{ rule.workspaceName ?? rule.workspaceId ?? "sem workspace" }}
              · {{ intervalLabel(rule.intervalSec) }}
              · última execução: {{ formatWhen(rule.lastEnqueuedAt) }}
            </p>
          </div>
          <div class="rule__actions">
            <button
              type="button"
              class="btn btn--ghost"
              @click="toggleEnabled(rule)"
            >
              {{ rule.enabled ? "Pausar" : "Ativar" }}
            </button>
            <button type="button" class="btn btn--ghost btn--remove" @click="removeRule(rule)">
              Remover
            </button>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped>
.form-card {
  padding: 20px;
  margin-bottom: var(--space-3);
}
.hint {
  margin-top: 6px;
  margin-bottom: 14px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.form {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: flex-end;
}
.field {
  display: flex;
  flex-direction: column;
  flex: 1 1 260px;
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.field--narrow {
  flex: 0 1 160px;
}
.field input,
.field textarea {
  margin-top: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-size: var(--text-sm);
  font-family: inherit;
}
.field small {
  margin-top: 4px;
  color: var(--text-soft);
}
.form-error {
  flex-basis: 100%;
  color: #f87171;
  font-size: var(--text-sm);
}
.rules {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  gap: 16px;
}
.rule__objective {
  font-weight: 600;
}
.rule__meta {
  margin-top: 4px;
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.rule__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.btn--remove {
  color: var(--danger);
  border-color: rgba(248, 113, 113, 0.25);
}
.btn--remove:hover:not(:disabled) {
  background: var(--danger-soft);
  color: var(--danger);
}
.quiet {
  color: var(--text-soft);
  font-size: var(--text-sm);
}
@media (max-width: 720px) {
  .rule {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
