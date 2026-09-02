<script setup lang="ts">
/**
 * Aba Hoje (P1.21 + P1.X-FIX) — tela de entrada do Escritorio
 * Operacional. Layout fiel ao handoff aprovado (OperationalOffice.dc.html).
 *
 * Fonte de dados por bloco (nenhum numero inventado):
 * - Estado/pulso: GET /office/status — andar-agnostico (agrega o
 *   escritorio inteiro); rotulado honestamente, nao filtrado por andar
 *   porque o endpoint nao suporta isso hoje.
 * - Acontecendo agora / Fila / Entregue: GET /missions?format=flat,
 *   filtrado por andar via originToFloor() (real, existe desde P1.2).
 *   Marketing nunca aparece aqui — nenhum MissionOrigin aponta pra ele.
 * - Precisa de voce: aprovacoes reais pendentes (GET /office/approvals),
 *   cada uma linkando pra tela real de aprovacao — nao ChangeProposal,
 *   que nao tem nenhuma UI de revisao no app hoje.
 * - Equipe/decisoes/automacoes (REG-14): mesmas fontes ja usadas em
 *   TeamView/DecisionsView/WorkView (useOffice, listDecisions,
 *   listAutomations) — sem endpoint novo, sem chamada duplicada (useOffice
 *   e um singleton ja carregado pelo OperationalShellLayout).
 *
 * P1.X-FIX:
 * - REG-07/09: estados loading/error/success explicitos — antes uma
 *   falha silenciava tudo, sem diferenciar "zero real" de "nao consegui
 *   consultar".
 * - REG-14: saudacao, aria-live, grade de acoes rapidas, secao de
 *   equipe, secao de decisoes, automacoes (andar Automacao), e as
 *   entregas voltam a mostrar nome (nao UUID) e ficam clicaveis.
 */
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { createOfficeStatusClient, type OfficeStatusDto } from "@/data/adapters/office-status-client";
import { createHttpClient } from "@/data/adapters/http-client";
import { officeCommandClient } from "@/data/adapters/office-client";
import { useOffice } from "@/composables/useOffice";
import { useAuth } from "@/composables/useAuth";
import type { ApprovalListItem, DecisionTraceDto, AutomationListItem } from "@/data/office-command";
import { originToFloor } from "@/lib/office-floor";
import type { MissionListItemDTO } from "@/data/dto";

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
const office = useOffice();
const auth = useAuth();

const statusClient = createOfficeStatusClient();
const httpClient = createHttpClient();

const status = ref<OfficeStatusDto | null>(null);
const missions = ref<readonly MissionListItemDTO[]>([]);
const approvals = ref<readonly ApprovalListItem[]>([]);
const decisions = ref<readonly DecisionTraceDto[]>([]);
const automations = ref<readonly AutomationListItem[]>([]);
const loading = ref(true);
const refreshing = ref(false);
const loadError = ref<string | null>(null);

async function loadAll(): Promise<void> {
  loadError.value = null;
  const calls: Promise<unknown>[] = [
    statusClient.get().then((v) => { status.value = v; }),
    httpClient
      .get<{ missions: MissionListItemDTO[] }>("/missions?format=flat&take=100")
      .then((v) => { missions.value = v.missions ?? []; }),
    officeCommandClient.listApprovals().then((v) => { approvals.value = v; }),
    officeCommandClient.listDecisions().then((v) => { decisions.value = v; }),
    office.load(),
  ];
  if (floor.value.id === "automation") {
    calls.push(officeCommandClient.listAutomations().then((v) => { automations.value = v; }));
  }
  const results = await Promise.allSettled(calls);
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length === results.length) {
    const first = failures[0] as PromiseRejectedResult;
    loadError.value =
      first.reason instanceof Error ? first.reason.message : "Não foi possível consultar o escritório.";
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    await loadAll();
  } finally {
    loading.value = false;
  }
});

async function refresh(): Promise<void> {
  refreshing.value = true;
  const minDelay = new Promise((resolve) => setTimeout(resolve, 500));
  await Promise.allSettled([loadAll(), minDelay]);
  refreshing.value = false;
}

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
});

const adminName = computed(() => auth.user.value?.login ?? "");

const QUICK_ACTIONS = computed(() => [
  { to: floor.value.newWorkRoute, title: floor.value.newWorkLabel, desc: "Descreva o trabalho que você precisa realizar." },
  { to: floor.value.workRoute, title: "Ver meu trabalho", desc: "Acompanhe missões, resultados e próximos passos." },
  { to: "/app/floor/dev/decisions", title: "Revisar decisões", desc: "Veja o que precisa da sua análise." },
  { to: "/app/floor/automation/triggers", title: "Gatilhos automáticos", desc: "Configure trabalho recorrente que roda sozinho." },
]);

const floorMissions = computed(() =>
  floor.value.missionFloor
    ? missions.value.filter((m) => originToFloor(m.origin) === floor.value.missionFloor)
    : [],
);
const running = computed(() => floorMissions.value.filter((m) => m.status === "RUNNING"));
const queued = computed(() => floorMissions.value.filter((m) => m.status === "QUEUED"));
const delivered = computed(() =>
  floorMissions.value
    .filter((m) => m.status === "COMPLETED")
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))
    .slice(0, 6),
);

const pendingApprovals = computed(() =>
  approvals.value.filter((a) => a.status === "PENDING"),
);

const levelInfo = computed(() => {
  switch (status.value?.status.level) {
    case "OPERATING":
      return { label: "Operando", tint: "var(--op-green)" };
    case "ATTENTION":
      return { label: "Atenção", tint: "var(--op-amber)" };
    case "PROBLEM":
      return { label: "Problema", tint: "var(--op-red)" };
    default:
      return { label: "—", tint: "var(--op-muted-4)" };
  }
});

const pulse = computed(() => [
  { value: String(status.value?.status.workers.alive ?? "—"), label: "workers vivos" },
  { value: String(running.value.length), label: "em execução" },
  { value: String(queued.value.length), label: "na fila" },
  { value: String(status.value?.attention.failed.newInWindow ?? "—"), label: "falhas 24h" },
]);

const RISK_LABEL: Record<string, string> = {
  LOW: "baixo", MEDIUM: "médio", HIGH: "alto", CRITICAL: "crítico",
};

function elapsedFrom(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}min`;
}

function ownerName(employeeId: string): string {
  return office.employeeById(employeeId)?.name ?? employeeId;
}

const onDuty = computed(() =>
  office.employees.value.map((e) => {
    const runningMission = running.value.find((m) => m.ownerEmployeeId === e.id);
    return { employee: e, currentObjective: runningMission?.objective ?? null };
  }),
);

const viewState = computed<"loading" | "error" | "ready">(() => {
  if (loading.value) return "loading";
  if (loadError.value && !status.value) return "error";
  return "ready";
});

const ariaSummary = computed(() => {
  if (!status.value) return "";
  return `Estado: ${levelInfo.value.label}. ${status.value.activity.message}. ${pendingApprovals.value.length} aprovações pendentes.`;
});
</script>

<template>
  <OperationalHeader
    :floor="floor"
    :scope-line="`${floor.name} · dados isolados`"
    title="Hoje"
    lede="O estado real deste andar agora — o que precisa de você, quem está trabalhando e o que já foi entregue."
    :refreshing="refreshing"
    @refresh="refresh"
  />

  <div class="op-content">
    <p v-if="viewState === 'loading'" class="op-loading">Carregando…</p>

    <div v-else-if="viewState === 'error'" class="op-error" role="alert">
      <p class="op-error__title">Não foi possível carregar o Hoje</p>
      <p class="op-error__body">{{ loadError }}</p>
      <button type="button" class="op-btn-retry" @click="refresh">Tentar de novo</button>
    </div>

    <template v-else>
      <div class="sr-only" aria-live="polite" aria-atomic="true">{{ ariaSummary }}</div>

      <p v-if="adminName" class="op-greeting">{{ greeting }}, {{ adminName }}.</p>

      <div class="op-hero">
        <div class="op-hero__state">
          <p class="op-eyebrow" :style="{ color: levelInfo.tint }">{{ levelInfo.label }}</p>
          <h2 class="op-hero__headline">{{ status?.status.summary ?? "Sem dados agora." }}</h2>
          <p class="op-hero__body">{{ status?.activity.message ?? "" }}</p>
          <div class="op-pulse-row">
            <div v-for="p in pulse" :key="p.label" class="op-pulse-item">
              <p class="op-mono op-pulse-value">{{ p.value }}</p>
              <p class="op-pulse-label">{{ p.label }}</p>
            </div>
          </div>
        </div>
        <div class="op-hero__asks">
          <div class="op-asks-head">
            <span class="op-dot" :style="{ background: pendingApprovals.length ? 'var(--op-amber)' : 'var(--op-green)' }" />
            <p class="op-eyebrow" :style="{ color: pendingApprovals.length ? 'var(--op-amber)' : 'var(--op-green)' }">Precisa de você</p>
          </div>
          <div v-for="a in pendingApprovals" :key="a.id" class="op-ask">
            <div class="op-ask__head">
              <p class="op-ask__title">{{ a.title }}</p>
              <span class="op-ask__severity">{{ RISK_LABEL[a.risk] ?? a.risk }}</span>
            </div>
            <p class="op-ask__detail">{{ a.actionSummary }}</p>
            <router-link :to="`/app/floor/dev/command/approvals/${a.id}`" class="op-ask__action">Revisar</router-link>
          </div>
          <p v-if="pendingApprovals.length === 0" class="op-ask-empty">Nada aguarda sua decisão agora.</p>
        </div>
      </div>

      <div class="op-section-head">
        <h3>Acontecendo agora</h3>
        <span class="op-mono op-section-count">{{ running.length }} em execução · {{ queued.length }} na fila</span>
      </div>
      <div class="op-running-grid">
        <router-link
          v-for="m in running"
          :key="m.id"
          :to="`/app/floor/dev/missions/${m.id}`"
          class="op-running-card"
        >
          <span class="op-running-bar" />
          <div class="op-running-main">
            <div class="op-running-title-row">
              <p class="op-running-title">{{ m.objective }}</p>
              <span class="op-mono op-running-kind">{{ m.missionKind }}</span>
            </div>
            <p class="op-running-owner">{{ ownerName(m.ownerEmployeeId) }}</p>
          </div>
          <div class="op-running-progress">
            <div class="op-progress-track">
              <div class="op-progress-fill" :style="{ width: `${m.progress ?? 0}%` }" />
            </div>
          </div>
          <p class="op-mono op-running-elapsed">{{ elapsedFrom(m.createdAt) }}</p>
        </router-link>
        <p v-if="running.length === 0" class="op-empty-dashed">Nenhum trabalho em execução neste andar agora.</p>
      </div>

      <div class="op-two-col">
        <section>
          <div class="op-section-head">
            <h3>Entregue recentemente</h3>
            <span class="op-mono op-section-count">{{ delivered.length }}</span>
          </div>
          <router-link
            v-for="d in delivered"
            :key="d.id"
            :to="`/app/floor/dev/missions/${d.id}`"
            class="op-list-row op-list-row--link"
          >
            <span class="op-dot" style="background: var(--op-green); margin-top: 5px" />
            <div class="op-list-row__main">
              <p class="op-list-row__title">{{ d.objective }}</p>
              <p class="op-list-row__meta">{{ ownerName(d.ownerEmployeeId) }}</p>
            </div>
            <span class="op-mono op-list-row__when">{{ d.finishedAt ? elapsedFrom(d.finishedAt) : "" }}</span>
          </router-link>
          <p v-if="delivered.length === 0" class="op-empty-inline">Nenhuma entrega registrada recentemente.</p>
        </section>

        <section>
          <div class="op-section-head">
            <h3>Fila</h3>
            <span class="op-mono op-section-count">{{ queued.length }} aguardando</span>
          </div>
          <div v-for="(q, i) in queued" :key="q.id" class="op-list-row">
            <span class="op-mono op-list-row__pos">{{ String(i + 1).padStart(2, "0") }}</span>
            <div class="op-list-row__main">
              <p class="op-list-row__title">{{ q.objective }}</p>
              <p class="op-list-row__meta">{{ ownerName(q.ownerEmployeeId) }}</p>
            </div>
            <span class="op-mono op-list-row__kind">{{ q.missionKind }}</span>
          </div>
          <p v-if="queued.length === 0" class="op-empty-inline">Fila vazia.</p>
        </section>
      </div>

      <div class="op-section-head">
        <h3>Comece por aqui</h3>
      </div>
      <div class="op-actions-grid">
        <router-link v-for="a in QUICK_ACTIONS" :key="a.title" :to="a.to" class="op-action-card">
          <p class="op-action-card__title">{{ a.title }}</p>
          <p class="op-action-card__desc">{{ a.desc }}</p>
        </router-link>
      </div>

      <div class="op-two-col">
        <section>
          <div class="op-section-head">
            <h3>Quem está no escritório agora</h3>
            <router-link :to="floor.teamRoute" class="op-section-link">Ver equipe</router-link>
          </div>
          <div v-for="d in onDuty.slice(0, 6)" :key="d.employee.id" class="op-person-row">
            <span class="op-avatar-circle">{{ d.employee.emoji }}</span>
            <div class="op-person-row__main">
              <p class="op-person-row__name">{{ d.employee.name }}</p>
              <p class="op-person-row__meta">
                {{ d.currentObjective ? `Trabalhando em: ${d.currentObjective}` : "Disponível agora" }}
              </p>
            </div>
          </div>
          <p v-if="onDuty.length === 0" class="op-empty-inline">Equipe ainda não disponível para consulta.</p>
        </section>

        <section>
          <div class="op-section-head">
            <h3>Decisões recentes</h3>
            <router-link to="/app/floor/dev/decisions" class="op-section-link">Ver todas</router-link>
          </div>
          <router-link
            v-for="d in decisions.slice(0, 4)"
            :key="d.decisionId"
            :to="`/app/floor/dev/decisions/${d.decisionId}`"
            class="op-list-row op-list-row--link"
          >
            <div class="op-list-row__main">
              <p class="op-list-row__title">{{ d.objective }}</p>
              <p class="op-list-row__meta">{{ d.rationale }}</p>
            </div>
          </router-link>
          <p v-if="decisions.length === 0" class="op-empty-inline">Nenhuma decisão registrada ainda.</p>
        </section>
      </div>

      <div v-if="floor.id === 'automation'">
        <div class="op-section-head">
          <h3>Automações</h3>
          <router-link :to="floor.workRoute" class="op-section-link">Ver catálogo</router-link>
        </div>
        <div class="op-work-grid">
          <router-link
            v-for="a in automations.slice(0, 2)"
            :key="a.id"
            :to="`/app/floor/automation/automations/${a.id}`"
            class="op-work-card"
          >
            <p class="op-work-card__name">{{ a.name }}</p>
            <p class="op-work-card__objective">{{ a.objective }}</p>
          </router-link>
        </div>
        <p v-if="automations.length === 0" class="op-empty-inline">Nenhuma automação registrada ainda.</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 24px 34px 40px;
}

.op-loading {
  color: var(--op-muted-4);
  font-size: 13px;
}

.op-eyebrow {
  font-family: var(--op-font-mono);
  font-size: 10.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.op-mono {
  font-family: var(--op-font-mono);
}

.op-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 1px;
  background: var(--op-line);
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  overflow: hidden;
  margin-bottom: 26px;
}

.op-hero__state {
  padding: 27px 30px;
  background: var(--op-panel);
}

.op-hero__headline {
  margin-top: 12px;
  font-size: 29px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.18;
  color: var(--op-ink);
  max-width: 21ch;
}

.op-hero__body {
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--op-muted-2);
  max-width: 54ch;
}

.op-pulse-row {
  display: flex;
  gap: 22px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--op-line);
}

.op-pulse-value {
  font-size: 21px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--op-ink);
}

.op-pulse-label {
  margin-top: 3px;
  font-size: 11px;
  color: var(--op-muted-5);
}

.op-hero__asks {
  padding: 24px 26px;
  background: var(--op-panel-2);
}

.op-asks-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.op-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--op-radius-full);
  flex-shrink: 0;
}

.op-ask {
  margin-top: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--op-line);
}

.op-ask__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.op-ask__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--op-ink-3);
}

.op-ask__severity {
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  padding: 2px 6px;
  border-radius: var(--op-radius-xs);
  background: var(--op-raise);
  color: var(--op-muted-2);
  text-transform: uppercase;
  flex-shrink: 0;
}

.op-ask__detail {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--op-muted-3);
}

.op-ask__action {
  display: inline-block;
  margin-top: 9px;
  padding: 5px 11px;
  border: 1px solid var(--op-bd-chip);
  border-radius: var(--op-radius-xs);
  color: var(--op-muted);
  font-size: 11.5px;
  font-weight: 500;
}

.op-ask__action:hover {
  border-color: var(--op-bd-chip-h);
  color: var(--op-ink-2);
  background: var(--op-raise);
}

.op-ask-empty {
  margin-top: 14px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--op-muted-3);
}

.op-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 13px;
}

.op-section-head h3 {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--op-ink-2);
}

.op-section-count {
  font-size: 11px;
  color: var(--op-muted-5);
}

.op-running-grid {
  display: grid;
  gap: 9px;
  margin-bottom: 30px;
}

.op-running-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 116px 74px;
  align-items: center;
  gap: 16px;
  padding: 15px 18px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  color: inherit;
  text-decoration: none;
  overflow: hidden;
}

.op-running-card:hover {
  border-color: var(--op-line-strong);
  background: var(--op-hover);
}

.op-running-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--op-cta);
}

.op-running-main {
  min-width: 0;
}

.op-running-title-row {
  display: flex;
  align-items: center;
  gap: 9px;
}

.op-running-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--op-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.op-running-kind {
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--op-muted-5);
  text-transform: uppercase;
  flex-shrink: 0;
}

.op-running-owner {
  margin-top: 4px;
  font-size: 12px;
  color: var(--op-muted-3);
}

.op-progress-track {
  height: 3px;
  border-radius: var(--op-radius-full);
  background: var(--op-track);
  overflow: hidden;
}

.op-progress-fill {
  height: 100%;
  background: var(--op-cta);
  border-radius: var(--op-radius-full);
}

.op-running-elapsed {
  font-size: 11.5px;
  color: var(--op-muted-4);
  text-align: right;
}

.op-empty-dashed {
  padding: 28px;
  border: 1px dashed var(--op-dash);
  border-radius: var(--op-radius);
  text-align: center;
  font-size: 13px;
  color: var(--op-muted-4);
}

.op-two-col {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 26px;
}

.op-list-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--op-line-soft);
}

.op-list-row__main {
  flex: 1;
  min-width: 0;
}

.op-list-row__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--op-ink-4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.op-list-row__meta {
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--op-muted-4);
}

.op-list-row__when,
.op-list-row__kind {
  font-size: 11px;
  color: var(--op-muted-5);
  flex-shrink: 0;
}

.op-list-row__pos {
  font-size: 10.5px;
  color: var(--op-muted-6);
  flex-shrink: 0;
  margin-top: 2px;
}

.op-empty-inline {
  padding: 14px 0;
  font-size: 12.5px;
  color: var(--op-muted-4);
}

@media (max-width: 900px) {
  .op-hero,
  .op-two-col {
    grid-template-columns: 1fr;
  }
  .op-running-card {
    grid-template-columns: 1fr;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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

.op-btn-retry:hover {
  border-color: var(--op-bd-btn-h);
}

.op-btn-retry:focus-visible {
  outline: 2px solid var(--op-cta);
  outline-offset: 2px;
}

.op-greeting {
  font-size: 13px;
  color: var(--op-muted-3);
  margin-bottom: 6px;
}

.op-section-link {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--op-cta);
  text-decoration: none;
}

.op-section-link:hover {
  text-decoration: underline;
}

.op-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 30px;
}

.op-action-card {
  display: block;
  padding: 16px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.op-action-card:hover {
  border-color: var(--op-line-strong);
  background: var(--op-hover);
}

.op-action-card__title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin-bottom: 4px;
}

.op-action-card__desc {
  font-size: 12px;
  color: var(--op-muted-3);
}

.op-list-row--link {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}

.op-list-row--link:hover {
  background: var(--op-hover);
}

.op-person-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--op-line-soft);
}

.op-avatar-circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--op-raise);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.op-person-row__main {
  min-width: 0;
}

.op-person-row__name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--op-ink-3);
}

.op-person-row__meta {
  margin-top: 2px;
  font-size: 11px;
  color: var(--op-muted-4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.op-work-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}

.op-work-card {
  display: block;
  padding: 14px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  color: inherit;
  text-decoration: none;
}

.op-work-card:hover {
  border-color: var(--op-line-strong);
  background: var(--op-hover);
}

.op-work-card__name {
  font-size: 13px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin-bottom: 4px;
}

.op-work-card__objective {
  font-size: 12px;
  color: var(--op-muted-3);
}

@media (max-width: 768px) {
  .op-actions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
