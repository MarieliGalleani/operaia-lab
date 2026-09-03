<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import RiskBadge from "@/components/command/RiskBadge.vue";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { ApprovalDetailDto } from "@/data/office-command";

const props = defineProps<{ id: string }>();
const route = useRoute();
const router = useRouter();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
const id = props.id || String(route.params.id);

const detail = ref<ApprovalDetailDto | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");
const feedback = ref("");

async function load(): Promise<void> {
  state.value = "loading";
  try {
    detail.value = await officeCommandClient.getApproval(id);
    state.value = detail.value ? "ready" : "error";
  } catch (error) {
    console.log("[approval-detail] failed", error);
    state.value = "error";
  }
}

onMounted(load);

async function act(action: "approve" | "reject" | "modify"): Promise<void> {
  const res = await officeCommandClient.actOnApproval(id, action);
  feedback.value = res.message;
  if (detail.value) {
    detail.value = { ...detail.value, status: res.status };
  }
  if (action === "modify") {
    await router.push({
      path: "/app/floor/dev/command/new",
      query: { workspace: detail.value?.workspaceId },
    });
  }
}
</script>

<template>
  <OperationalHeader
    :floor="floor"
    scope-line="Comando · Aprovações · Detalhe"
    title="Aprovação"
    lede="Por que o escritório está pedindo sua decisão neste caso."
    :show-cta="false"
    :show-refresh="false"
  >
    <template #extra>
      <router-link to="/app/floor/dev/command/approvals" class="op-btn">Voltar</router-link>
    </template>
  </OperationalHeader>
  <div class="op-content">
    <p v-if="state === 'loading'" class="op-loading">Carregando aprovação…</p>
    <div v-else-if="state === 'error'" class="op-error" role="alert">
      <p class="op-error__title">Aprovação não encontrada</p>
      <p class="op-error__body">Ela pode já ter sido resolvida ou o link está incorreto.</p>
    </div>
    <template v-else-if="detail">
      <p v-if="feedback" class="op-feedback" role="status">{{ feedback }}</p>
      <section class="op-impact">
        <p class="op-eyebrow-sm">Aprovação necessária</p>
        <h2 class="op-impact__question">Por que estou pedindo sua aprovação?</h2>

        <dl class="op-impact__grid">
          <div>
            <dt>Ação</dt>
            <dd>{{ detail.action }}</dd>
          </div>
          <div>
            <dt>Workspace</dt>
            <dd>{{ detail.workspaceName }}</dd>
          </div>
          <div>
            <dt>Risco</dt>
            <dd><RiskBadge :risk="detail.risk" /></dd>
          </div>
          <div>
            <dt>Impacto</dt>
            <dd>{{ detail.impact }}</dd>
          </div>
          <div>
            <dt>Motivo</dt>
            <dd>{{ detail.reason }}</dd>
          </div>
          <div>
            <dt>Plano</dt>
            <dd>{{ detail.planSummary }}</dd>
          </div>
          <div>
            <dt>Já validado</dt>
            <dd>
              <ul class="op-impact__list">
                <li v-for="v in detail.validated" :key="v">{{ v }}</li>
              </ul>
            </dd>
          </div>
          <div>
            <dt>Se aprovar</dt>
            <dd>{{ detail.ifApprove }}</dd>
          </div>
          <div>
            <dt>Se recusar</dt>
            <dd>{{ detail.ifReject }}</dd>
          </div>
          <div>
            <dt>Decisão do escritório</dt>
            <dd>{{ detail.officeDecision }}</dd>
          </div>
        </dl>

        <div class="op-impact__actions" role="group" aria-label="Ações de aprovação">
          <button type="button" class="op-btn op-btn--approve" @click="act('approve')">
            Aprovar
          </button>
          <button type="button" class="op-btn op-btn--danger" @click="act('reject')">
            Recusar
          </button>
          <button type="button" class="op-btn" @click="act('modify')">
            Modificar
          </button>
        </div>
      </section>
    </template>
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

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
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
}

.op-feedback {
  max-width: 720px;
  margin-bottom: 14px;
  padding: 10px 14px;
  border: 1px solid var(--op-line-strong);
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  font-size: 12.5px;
  color: var(--op-ink-3);
}

.op-impact {
  max-width: 720px;
  padding: 24px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-impact__question {
  margin-top: 6px;
  font-size: 19px;
  font-weight: 700;
  color: var(--op-ink);
  letter-spacing: -0.02em;
}

.op-impact__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin-top: 20px;
}

.op-impact__grid > div {
  padding: 12px 14px 12px 0;
  border-bottom: 1px solid var(--op-line);
}

.op-impact__grid dt {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--op-muted-5);
  margin-bottom: 4px;
}

.op-impact__grid dd {
  margin: 0;
  font-size: 13px;
  color: var(--op-ink-3);
}

.op-impact__list {
  margin: 0;
  padding-left: 18px;
}

.op-impact__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
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

.op-btn--approve {
  border-color: var(--op-cta);
  background: var(--op-cta);
  color: #fff;
  font-weight: 600;
}

.op-btn--approve:hover:not(:disabled) {
  background: var(--op-cta-h);
  border-color: var(--op-cta-h);
}

.op-btn--danger {
  border-color: var(--op-red);
  color: var(--op-red);
}

.op-btn--danger:hover:not(:disabled) {
  background: var(--op-red);
  color: #fff;
}

@media (max-width: 768px) {
  .op-impact__grid {
    grid-template-columns: 1fr;
  }
}
</style>
