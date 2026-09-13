<script setup lang="ts">
/**
 * O Mural (P1.X — plano "O Mural do Escritório", Fase 1+2).
 *
 * Feed cronológico de atividade real do andar: aprovações que precisam
 * de decisão (com Aprovar/Rejeitar ali mesmo, sem trocar de tela) mais
 * uma fonte de "o que já aconteceu" especifica de cada andar — execuções
 * de automação, decisões da Opera, ou campanhas do Mercúrio. Nenhuma
 * tabela nova — só combina o que as APIs de cada andar já retornam, e
 * escuta o WebSocket de status ao vivo pra se atualizar sozinho quando
 * algo novo acontece.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { ApprovalListItem, DecisionTraceDto, ExecutionListItem } from "@/data/office-command";
import { RISK_LABEL } from "@/data/office-command";
import { connectLiveStatusSocket } from "@/modules/office-domain/live-status-socket";
import { createMarketingOfficeClient, type MarketingCampaign } from "@/data/adapters/marketing-office-client";

const props = defineProps<{ floorId: "dev" | "automation" | "marketing"; workspaceId?: string }>();

type MuralItem =
  | { kind: "approval"; id: string; at: string; data: ApprovalListItem }
  | { kind: "execution"; id: string; at: string; data: ExecutionListItem }
  | { kind: "decision"; id: string; at: string; data: DecisionTraceDto }
  | { kind: "campaign"; id: string; at: string; data: MarketingCampaign };

const marketingClient = createMarketingOfficeClient();

const approvals = ref<readonly ApprovalListItem[]>([]);
const executions = ref<readonly ExecutionListItem[]>([]);
const decisions = ref<readonly DecisionTraceDto[]>([]);
const campaigns = ref<readonly MarketingCampaign[]>([]);
const state = ref<"idle" | "loading" | "ready" | "error">("idle");
const error = ref<string | null>(null);
const acting = ref<string | null>(null);
const live = ref(false);

let disconnectLive: (() => void) | null = null;

async function load(): Promise<void> {
  if (state.value === "idle") state.value = "loading";
  error.value = null;
  try {
    const calls: Promise<unknown>[] = [
      officeCommandClient.listApprovals(props.workspaceId).then((v) => {
        approvals.value = v;
      }),
    ];
    if (props.floorId === "automation") {
      calls.push(
        officeCommandClient.listExecutions(props.workspaceId).then((v) => {
          executions.value = v;
        }),
      );
    } else if (props.floorId === "dev") {
      calls.push(
        officeCommandClient.listDecisions(props.workspaceId).then((v) => {
          decisions.value = v;
        }),
      );
    } else {
      calls.push(
        marketingClient.listCampaigns().then((v) => {
          campaigns.value = v;
        }),
      );
    }
    await Promise.all(calls);
    state.value = "ready";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Não foi possível carregar o mural.";
    state.value = "error";
    console.log("[mural] falha ao carregar", err);
  }
}

const CONFIDENCE_LABEL: Record<DecisionTraceDto["confidence"], string> = {
  LOW: "baixa",
  MEDIUM: "média",
  HIGH: "alta",
};

const CAMPAIGN_STATUS_LABEL: Record<MarketingCampaign["status"], string> = {
  PENDING: "na fila",
  RUNNING: "trabalhando",
  DONE: "concluída",
  ERROR: "falhou",
};

const items = computed<MuralItem[]>(() => {
  const approvalItems: MuralItem[] = approvals.value.map((a) => ({
    kind: "approval",
    id: `appr-${a.id}`,
    at: a.createdAt,
    data: a,
  }));
  const executionItems: MuralItem[] = executions.value.map((e) => ({
    kind: "execution",
    id: `exec-${e.id}`,
    at: e.finishedAt ?? e.startedAt,
    data: e,
  }));
  const decisionItems: MuralItem[] = decisions.value.map((d) => ({
    kind: "decision",
    id: `dec-${d.decisionId}`,
    at: d.createdAt,
    data: d,
  }));
  const campaignItems: MuralItem[] = campaigns.value.map((c) => ({
    kind: "campaign",
    id: `camp-${c.id}`,
    at: c.updatedAt,
    data: c,
  }));
  return [...approvalItems, ...executionItems, ...decisionItems, ...campaignItems]
    .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
    .slice(0, 20);
});

function initials(label: string): string {
  return label.trim().slice(0, 2).toUpperCase();
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

function duration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "em andamento";
  const s = Math.max(1, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.round(s / 60)}min`;
}

function executionStatusLabel(status: ExecutionListItem["status"]): string {
  switch (status) {
    case "SUCCESS":
      return "concluída";
    case "FAILED":
      return "falhou";
    case "RUNNING":
      return "em execução";
    case "WAITING_APPROVAL":
      return "aguardando aprovação";
    case "CANCELLED":
      return "cancelada";
    default:
      return "na fila";
  }
}

async function act(approval: ApprovalListItem, action: "approve" | "reject"): Promise<void> {
  acting.value = approval.id;
  try {
    await officeCommandClient.actOnApproval(approval.id, action);
    approvals.value = approvals.value.map((a) =>
      a.id === approval.id ? { ...a, status: action === "approve" ? "APPROVED" : "REJECTED" } : a,
    );
  } catch (err) {
    console.log("[mural] falha ao agir na aprovação", err);
  } finally {
    acting.value = null;
  }
}

onMounted(() => {
  void load();
  disconnectLive = connectLiveStatusSocket({
    onEvent: () => void load(),
    onConnectionChange: (connected) => {
      live.value = connected;
    },
  });
});

onBeforeUnmount(() => {
  disconnectLive?.();
});
</script>

<template>
  <section class="op-mural">
    <div class="op-mural__head">
      <h3 class="op-mural__title">O Mural</h3>
      <span class="op-mural__live" :class="{ 'is-live': live }">
        <span class="op-mural__dot" />
        {{ live ? "ao vivo" : "offline" }}
      </span>
    </div>

    <p v-if="state === 'loading'" class="op-mural__empty">Consultando o mural…</p>
    <p v-else-if="state === 'error'" class="op-mural__empty">{{ error }}</p>
    <p v-else-if="items.length === 0" class="op-mural__empty">Nada por aqui ainda.</p>

    <ul v-else class="op-mural__list">
      <li v-for="item in items" :key="item.id" class="op-mural-card">
        <span class="op-mural-card__avatar">{{
          item.kind === "approval"
            ? "OP"
            : item.kind === "execution"
              ? initials(item.data.automationName)
              : item.kind === "decision"
                ? initials(item.data.responsibleLabel)
                : "ME"
        }}</span>

        <div class="op-mural-card__body">
          <div class="op-mural-card__head">
            <strong>{{
              item.kind === "approval"
                ? "Opera"
                : item.kind === "execution"
                  ? item.data.automationName
                  : item.kind === "decision"
                    ? item.data.responsibleLabel
                    : "Mercúrio"
            }}</strong>
            <span v-if="item.kind === 'approval'" class="op-mural-card__badge">
              risco {{ RISK_LABEL[item.data.risk] }}
            </span>
            <span v-else-if="item.kind === 'execution'" class="op-mural-card__badge">
              {{ executionStatusLabel(item.data.status) }} · {{ duration(item.data.startedAt, item.data.finishedAt) }}
            </span>
            <span v-else-if="item.kind === 'decision'" class="op-mural-card__badge">
              confiança {{ CONFIDENCE_LABEL[item.data.confidence] }}
            </span>
            <span v-else class="op-mural-card__badge">
              {{ CAMPAIGN_STATUS_LABEL[item.data.status] }}
            </span>
            <span class="op-mural-card__time">{{ timeAgo(item.at) }}</span>
          </div>

          <p class="op-mural-card__summary">
            {{
              item.kind === "approval"
                ? item.data.actionSummary
                : item.kind === "execution"
                  ? `Workspace ${item.data.workspaceName}`
                  : item.kind === "decision"
                    ? item.data.objective
                    : `Campanha "${item.data.niche}"`
            }}
          </p>

          <div v-if="item.kind === 'approval' && item.data.status === 'PENDING'" class="op-mural-card__actions">
            <button
              type="button"
              class="op-mural-btn op-mural-btn--good"
              :disabled="acting === item.data.id"
              @click="act(item.data, 'approve')"
            >
              {{ acting === item.data.id ? "…" : "Aprovar" }}
            </button>
            <button
              type="button"
              class="op-mural-btn"
              :disabled="acting === item.data.id"
              @click="act(item.data, 'reject')"
            >
              Rejeitar
            </button>
            <router-link
              :to="`/app/floor/${props.floorId}/command/approvals/${item.data.id}`"
              class="op-mural-btn op-mural-btn--link"
            >
              Ver detalhes
            </router-link>
          </div>
          <p v-else-if="item.kind === 'approval'" class="op-mural-card__resolved">
            {{ item.data.status === "APPROVED" ? "Aprovada" : item.data.status === "REJECTED" ? "Rejeitada" : item.data.status }}
          </p>

          <router-link
            v-else-if="item.kind === 'decision'"
            :to="`/app/floor/${props.floorId}/decisions/${item.data.decisionId}`"
            class="op-mural-btn op-mural-btn--link"
          >
            Ver decisão
          </router-link>
          <router-link
            v-else-if="item.kind === 'campaign'"
            to="/app/floor/marketing/work"
            class="op-mural-btn op-mural-btn--link"
          >
            Ver campanha
          </router-link>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.op-mural {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  padding: 20px;
}

.op-mural__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.op-mural__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin: 0;
}

.op-mural__live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--op-muted-3);
}

.op-mural__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--op-muted-5);
}

.op-mural__live.is-live .op-mural__dot {
  background: var(--op-green);
  box-shadow: 0 0 0 3px var(--op-halo);
}

.op-mural__live.is-live {
  color: var(--op-green);
}

.op-mural__empty {
  font-size: 13px;
  color: var(--op-muted-3);
}

.op-mural__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.op-mural-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
}

.op-mural-card__avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--op-ink-2);
  background: var(--op-sel);
  border: 1px solid var(--op-bd-sel);
}

.op-mural-card__body {
  flex: 1;
  min-width: 0;
}

.op-mural-card__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12.5px;
}

.op-mural-card__head strong {
  color: var(--op-ink-2);
}

.op-mural-card__badge {
  font-family: var(--op-font-mono);
  font-size: 10.5px;
  color: var(--op-muted-2);
  background: var(--op-panel);
  border: 1px solid var(--op-line);
  padding: 1px 7px;
  border-radius: var(--op-radius-full);
}

.op-mural-card__time {
  margin-left: auto;
  font-size: 11px;
  color: var(--op-muted-4);
}

.op-mural-card__summary {
  font-size: 13px;
  color: var(--op-ink-3);
  margin: 0 0 8px;
  line-height: 1.5;
}

.op-mural-card__resolved {
  font-size: 11.5px;
  color: var(--op-muted-3);
  margin: 0;
}

.op-mural-card__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.op-mural-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-panel);
  color: var(--op-ink-2);
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.op-mural-btn:hover:not(:disabled) {
  border-color: var(--op-bd-btn-h);
}

.op-mural-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.op-mural-btn--good {
  background: var(--op-green);
  border-color: var(--op-green);
  color: #06280f;
}

.op-mural-btn--link {
  border-color: transparent;
  color: var(--op-cta);
  padding-left: 4px;
  padding-right: 4px;
}
</style>
