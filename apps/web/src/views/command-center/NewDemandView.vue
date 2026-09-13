<script setup lang="ts">
/** Fase 5 — O Mural do Escritório: migra pro sistema visual atual (--op-*). */
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import CommandInput from "@/components/command/CommandInput.vue";
import RiskBadge from "@/components/command/RiskBadge.vue";
import AutonomyBadge from "@/components/command/AutonomyBadge.vue";
import WorkspaceContext from "@/components/command/WorkspaceContext.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
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
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
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
  <OperationalHeader
    :floor="floor"
    scope-line="Trabalho · Nova demanda"
    title="Nova demanda"
    lede="Descreva o trabalho com suas palavras — o escritório organiza o pedido antes de propor os próximos passos."
    :show-cta="false"
    :show-refresh="false"
  />
  <div class="op-content">
    <p v-if="mockMode" class="op-note" role="status">
      Modo mock explícito — interpretação/execução não são operações reais.
    </p>
    <p v-if="error" class="op-error-inline" role="alert">{{ error }}</p>

    <section v-if="step === 'input'" class="op-panel op-demand">
      <p class="op-eyebrow-sm">Comece pelo resultado que você deseja</p>
      <h2 class="op-demand__question">O que você precisa?</h2>
      <CommandInput
        v-model="text"
        :disabled="interpreting"
        placeholder="Descreva o trabalho que você quer realizar."
        @submit="interpret"
      />
      <label class="op-demand__ws">
        <span>Onde esse trabalho acontece?</span>
        <select v-model="workspaceId" class="op-select" :disabled="interpreting" required>
          <option disabled value="">Selecione um cliente ou workspace</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <WorkspaceContext
        v-if="workspaceId"
        :name="workspaceName"
        :kind="workspaceId.includes('opera') || workspaceId === 'nexo' ? 'lab' : 'client'"
      />
      <button type="button" class="op-btn op-btn--cta" :disabled="!canInterpret || interpreting" @click="interpret">
        {{ interpreting ? "Organizando…" : "Continuar" }}
      </button>
    </section>

    <LoadingState v-if="interpreting" label="Interpretando demanda" />

    <section v-else-if="step === 'understood' && brief" class="op-panel op-demand">
      <p class="op-eyebrow-sm">Entendi</p>
      <h2 class="op-demand__title">Interpretação</h2>
      <p class="op-demand__help">Triagem automática por regras de risco — revise antes de confirmar.</p>
      <dl class="op-demand__dl">
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
            <div class="op-demand__auto">
              <button
                v-for="level in (['READ_PLAN','CONTROLLED','AUTONOMOUS','HUMAN_APPROVAL'] as AutonomyLevel[])"
                :key="level"
                type="button"
                class="op-btn op-btn--sm"
                :class="{ 'is-on': brief.autonomy === level }"
                @click="setAutonomy(level)"
              >
                {{ AUTONOMY_LABEL[level] }}
              </button>
            </div>
            <AutonomyBadge :autonomy="brief.autonomy" />
            <p class="op-demand__help">{{ autonomyHelp[brief.autonomy] }}</p>
          </dd>
        </div>
      </dl>
      <div class="op-demand__actions">
        <button type="button" class="op-btn op-btn--cta" @click="goPlan">Continuar para o plano</button>
        <button type="button" class="op-btn" @click="editObjective">Editar objetivo</button>
      </div>
    </section>

    <section v-else-if="step === 'plan' && brief && plan" class="op-panel op-demand">
      <p class="op-eyebrow-sm">Plano inicial</p>
      <h2 class="op-demand__title">O que será feito</h2>
      <ol class="op-demand__plan">
        <li v-for="(s, i) in plan.steps" :key="s.id">
          <span class="op-demand__n">{{ i + 1 }}</span>
          <div>
            <strong>{{ s.title }}</strong>
            <p v-if="s.assigneeLabel">{{ s.assigneeLabel }}</p>
          </div>
        </li>
      </ol>
      <p class="op-demand__help">
        Autonomia {{ AUTONOMY_LABEL[brief.autonomy] }} — {{ autonomyHelp[brief.autonomy] }}
      </p>
      <div class="op-demand__actions">
        <button type="button" class="op-btn op-btn--cta" :disabled="executing" @click="executePlan">
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
        <button type="button" class="op-btn" @click="editObjective">Editar objetivo</button>
      </div>
    </section>

    <section v-else-if="step === 'result'" class="op-panel op-demand">
      <p class="op-eyebrow-sm">Resultado</p>
      <h2 class="op-demand__title">{{ resultAccepted ? "Execução aceita" : "Execução não iniciada" }}</h2>
      <p class="op-demand__help">{{ resultMessage }}</p>
      <div class="op-demand__actions">
        <router-link to="/app/command" class="op-btn op-btn--cta">Voltar ao Command Center</router-link>
      </div>
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
  gap: 16px;
}

.op-note {
  font-size: 12px;
  color: var(--op-amber);
}

.op-error-inline {
  font-size: 12.5px;
  color: var(--op-red);
}

.op-panel {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  padding: 22px;
  max-width: 720px;
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-demand__question {
  margin: 8px 0 18px;
  font-size: 22px;
  font-weight: 700;
  color: var(--op-ink);
}

.op-demand__title {
  margin: 8px 0 4px;
  font-size: 17px;
  font-weight: 700;
  color: var(--op-ink);
}

.op-demand__ws {
  display: block;
  margin: 16px 0;
}

.op-demand__ws span {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--op-ink-3);
  margin-bottom: 6px;
}

.op-select {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-line);
  background: var(--op-raise);
  color: var(--op-ink-2);
  font: inherit;
}

.op-select:focus {
  outline: none;
  border-color: var(--op-cta);
}

.op-demand__dl > div {
  padding: 10px 0;
  border-bottom: 1px solid var(--op-line);
}

.op-demand__dl dt {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--op-muted-5);
}

.op-demand__dl dd {
  margin: 4px 0 0;
  color: var(--op-ink-3);
  font-size: 13px;
}

.op-demand__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.op-demand__auto {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.op-demand__help {
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--op-muted-3);
}

.op-demand__plan {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
}

.op-demand__plan li {
  display: flex;
  padding: 10px 0;
  border-bottom: 1px solid var(--op-line);
}

.op-demand__n {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--op-halo);
  color: var(--op-green);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  margin-right: 12px;
  flex-shrink: 0;
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
  text-decoration: none;
}

.op-btn:hover:not(:disabled) {
  border-color: var(--op-bd-btn-h);
}

.op-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.op-btn--sm {
  padding: 5px 10px;
  font-size: 12px;
}

.op-btn.is-on {
  border-color: var(--op-cta);
  color: var(--op-cta);
  background: var(--op-sel);
}

.op-btn--cta {
  background: var(--op-cta);
  border-color: var(--op-cta);
  color: #fff;
}

.op-btn--cta:hover:not(:disabled) {
  background: var(--op-cta-h);
}

@media (max-width: 768px) {
  .op-panel {
    max-width: none;
  }
}
</style>
