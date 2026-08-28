<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import CommandInput from "@/components/command/CommandInput.vue";
import RiskBadge from "@/components/command/RiskBadge.vue";
import AutonomyBadge from "@/components/command/AutonomyBadge.vue";
import WorkspaceContext from "@/components/command/WorkspaceContext.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { useOffice } from "@/composables/useOffice";
import { officeCommandClient } from "@/data/adapters/office-client";
import {
  AUTONOMY_LABEL,
  type AutonomyLevel,
  type DemandBrief,
  type WorkPlan,
} from "@/data/office-command";

type Step = "input" | "understood" | "plan" | "result";

const route = useRoute();
const router = useRouter();
const { projects, load } = useOffice();
void load();

const step = ref<Step>("input");
const text = ref("");
const workspaceId = ref(String(route.query.workspace ?? ""));
const interpreting = ref(false);
const executing = ref(false);
const error = ref("");
const brief = ref<DemandBrief | null>(null);
const plan = ref<WorkPlan | null>(null);
const resultMessage = ref("");
const resultAccepted = ref(false);
/** true somente quando a resposta veio do mock explícito. */
const mockMode = ref(false);

onMounted(() => {
  if (route.query.workspace) {
    workspaceId.value = String(route.query.workspace);
  }
});


const workspaceName = computed(() => {
  const p = projects.value.find((x) => x.id === workspaceId.value);
  return p?.name ?? workspaceId.value;
});

const canInterpret = computed(
  () => text.value.trim().length > 0 && workspaceId.value.length > 0,
);

const autonomyHelp: Record<AutonomyLevel, string> = {
  READ_PLAN: "O escritório interpreta e planeja, sem executar.",
  CONTROLLED:
    "O escritório executa após sua confirmação; pede aprovação se o risco subir.",
  AUTONOMOUS: "O escritório inicia sozinho após interpretar (com opção de pausar).",
  HUMAN_APPROVAL: "A execução fica bloqueada até aprovação humana.",
};

async function interpret() {
  if (!canInterpret.value) return;
  interpreting.value = true;
  error.value = "";
  try {
    const res = await officeCommandClient.interpretDemand(
      text.value.trim(),
      workspaceId.value,
      workspaceName.value,
    );
    brief.value = res.brief;
    plan.value = res.plan;
    mockMode.value = res.source === "mock-temporary" || res.backendDependency;
    step.value = "understood";
  } catch (err) {
    console.log("[new-demand] interpret failed", err);
    error.value = "Não foi possível interpretar a demanda.";
  } finally {
    interpreting.value = false;
  }
}

function goPlan() {
  step.value = "plan";
}

async function executePlan() {
  if (!brief.value || !plan.value) return;
  const autonomy = brief.value.autonomy;
  if (autonomy === "READ_PLAN") {
    resultAccepted.value = false;
    resultMessage.value =
      "Autonomia Planejar: o plano foi gerado. Nenhuma execução foi iniciada.";
    step.value = "result";
    return;
  }
  if (autonomy === "HUMAN_APPROVAL") {
    await router.push("/app/command/approvals");
    return;
  }
  executing.value = true;
  error.value = "";
  try {
    const res = await officeCommandClient.executeDemand(
      brief.value.demandId,
      autonomy,
    );
    resultAccepted.value = res.accepted;
    resultMessage.value = res.message;
    mockMode.value = res.source === "mock-temporary" || res.backendDependency;
    step.value = "result";
  } catch (err) {
    console.log("[new-demand] execute failed", err);
    error.value = "Falha ao solicitar execução.";
  } finally {
    executing.value = false;
  }
}

function editObjective() {
  step.value = "input";
}

function setAutonomy(level: AutonomyLevel) {
  if (!brief.value) return;
  brief.value = { ...brief.value, autonomy: level };
}
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Trabalho › Nova demanda</p>
        <h1 class="page__title">Nova demanda</h1>
      </div>
      <router-link to="/app/command" class="btn btn--ghost">Voltar</router-link>
    </header>

    <div class="studio__stage demand">
      <p v-if="mockMode" class="backend-note" role="status">
        Modo mock explícito — interpretação/execução não são operações reais.
      </p>

      <p v-if="error" class="demand__error" role="alert">{{ error }}</p>

      <section v-if="step === 'input'" class="panel demand__panel">
        <p class="eyebrow">Comece pelo resultado que você deseja</p>
        <h2 class="demand__question">O que você precisa?</h2>
        <p class="demand__intro">
          Descreva o trabalho com suas palavras. A OperaIA organiza o pedido antes de propor os próximos passos.
        </p>
        <CommandInput
          v-model="text"
          :disabled="interpreting"
          placeholder="Descreva o trabalho que você quer realizar."
          @submit="interpret"
        />
        <label class="demand__ws">
          <span>Onde esse trabalho acontece?</span>
          <select v-model="workspaceId" :disabled="interpreting" required>
            <option disabled value="">Selecione um cliente ou workspace</option>
            <option v-for="p in projects" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
        </label>
        <WorkspaceContext
          v-if="workspaceId"
          :name="workspaceName"
          :kind="workspaceId.includes('opera') || workspaceId === 'nexo' ? 'lab' : 'client'"
        />
        <button
          type="button"
          class="btn btn--primary"
          :disabled="!canInterpret || interpreting"
          @click="interpret"
        >
          {{ interpreting ? "Organizando…" : "Continuar" }}
        </button>
      </section>

      <LoadingState v-if="interpreting" label="Interpretando demanda" />

      <section v-else-if="step === 'understood' && brief" class="panel demand__panel">
        <p class="eyebrow">Entendi</p>
        <h2 class="section__title">Interpretação</h2>
        <p class="demand__help">
          Triagem automática por regras de risco — revise antes de confirmar.
        </p>
        <dl class="demand__dl">
          <div><dt>Cliente</dt><dd>{{ brief.workspaceName }}</dd></div>
          <div><dt>Objetivo</dt><dd>{{ brief.objective }}</dd></div>
          <div><dt>Resultado esperado</dt><dd>{{ brief.expectedOutcome }}</dd></div>
          <div><dt>Dependências</dt><dd>{{ brief.dependencies.join(", ") }}</dd></div>
          <div>
            <dt>Risco</dt>
            <dd><RiskBadge :risk="brief.risk" /></dd>
          </div>
          <div>
            <dt>Autonomia</dt>
            <dd>
              <div class="demand__auto">
                <button
                  v-for="level in (['READ_PLAN','CONTROLLED','AUTONOMOUS','HUMAN_APPROVAL'] as AutonomyLevel[])"
                  :key="level"
                  type="button"
                  class="btn btn--ghost"
                  :class="{ 'demand__auto--on': brief.autonomy === level }"
                  @click="setAutonomy(level)"
                >
                  {{ AUTONOMY_LABEL[level] }}
                </button>
              </div>
              <AutonomyBadge :autonomy="brief.autonomy" />
              <p class="demand__help">{{ autonomyHelp[brief.autonomy] }}</p>
            </dd>
          </div>
        </dl>
        <div class="demand__actions">
          <button type="button" class="btn btn--primary" @click="goPlan">
            Continuar para o plano
          </button>
          <button type="button" class="btn btn--ghost" @click="editObjective">
            Editar objetivo
          </button>
        </div>
      </section>

      <section v-else-if="step === 'plan' && brief && plan" class="panel demand__panel">
        <p class="eyebrow">Plano inicial</p>
        <h2 class="section__title">O que será feito</h2>
        <ol class="demand__plan">
          <li v-for="(s, i) in plan.steps" :key="s.id">
            <span class="demand__n">{{ i + 1 }}</span>
            <div>
              <strong>{{ s.title }}</strong>
              <p v-if="s.assigneeLabel">{{ s.assigneeLabel }}</p>
            </div>
          </li>
        </ol>
        <p class="demand__help">
          Autonomia {{ AUTONOMY_LABEL[brief.autonomy] }} —
          {{ autonomyHelp[brief.autonomy] }}
        </p>
        <div class="demand__actions">
          <button
            type="button"
            class="btn btn--primary"
            :disabled="executing"
            @click="executePlan"
          >
            {{
              brief.autonomy === "READ_PLAN"
                ? "Encerrar no plano"
                : brief.autonomy === "HUMAN_APPROVAL"
                  ? "Ir para aprovações"
                  : executing
                    ? "Solicitando…"
                    : "Executar plano"
            }}
          </button>
          <button type="button" class="btn btn--ghost" @click="editObjective">
            Editar objetivo
          </button>
        </div>
      </section>

      <section v-else-if="step === 'result'" class="panel demand__panel">
        <p class="eyebrow">Resultado</p>
        <h2 class="section__title">
          {{ resultAccepted ? "Execução aceita" : "Execução não iniciada" }}
        </h2>
        <p>{{ resultMessage }}</p>
        <div class="demand__actions">
          <router-link to="/app/command" class="btn btn--primary">
            Voltar ao Command Center
          </router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.demand__panel {
  padding: 22px;
  max-width: 720px;
}
.demand__question {
  margin-top: 8px;
  font-size: var(--text-2xl);
}
.demand__intro {
  max-width: 580px;
  margin: 8px 0 22px;
  color: var(--text-muted);
}
.demand__ws {
  display: block;
  margin: 16px 0;
}
.demand__ws span {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  margin-bottom: 6px;
}
.demand__ws select {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
.demand__dl > div {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.demand__dl dt {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-soft);
}
.demand__dl dd {
  margin: 4px 0 0;
  color: var(--text);
}
.demand__actions {
  display: flex;
  flex-wrap: wrap;
  margin-top: 20px;
}
.demand__actions .btn {
  margin-right: 10px;
  margin-bottom: 8px;
}
.demand__auto {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.demand__auto .btn {
  margin-right: 6px;
  margin-bottom: 6px;
  padding: 6px 10px;
}
.demand__auto--on {
  border-color: var(--brand-line);
  color: var(--text);
  background: var(--brand-soft);
}
.demand__help {
  margin-top: 8px;
  font-size: var(--text-sm);
}
.demand__plan {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
}
.demand__plan li {
  display: flex;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.demand__n {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: 700;
  margin-right: 12px;
  flex-shrink: 0;
}
.demand__error {
  color: var(--danger);
  margin-bottom: 12px;
}
@media (max-width: 768px) {
  .demand__panel {
    max-width: none;
  }
}
</style>
