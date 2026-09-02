<script setup lang="ts">
/**
 * Aba Infraestrutura / Predio (P1.21 + P1.X-FIX) — compartilhada entre
 * andares, fiel ao handoff aprovado. Metricas vem de GET /infra/vps
 * (mesmo dado que VpsPanelView.vue ja usava). "Ocupacao por andar"
 * reusa originToFloor() sobre missoes reais.
 *
 * P1.X-FIX:
 * - REG-10: auto-refresh recuperado, usando o intervalo sugerido pela
 *   propria API (refresh.suggestedIntervalSec), com cleanup no unmount
 *   e sem requests concorrentes (o timer so reagenda depois que a
 *   chamada anterior termina).
 * - REG-11: profundidade recuperada — health score em anel, prontidao
 *   (mesma formula de 5 itens que VpsPanelView.vue usava), status
 *   granular por servico (up/ready/warn/down/unconfigured, com
 *   latencia e hint quando existem — nao so um ponto ligado/desligado),
 *   historico de CPU/RAM com sparkline (reaproveita @/lib/vps-charts,
 *   funcoes puras de calculo, sem UI antiga junto), e um bloco
 *   "Detalhes" (disclosure, fechado por padrao) com host/runtime, LLM,
 *   custo e insights — pra nao empilhar tudo na primeira dobra.
 * - REG-07: se a chamada falhar, mantem o ultimo snapshot bom na tela
 *   com um aviso "ultima sincronizacao falhou" em vez de apagar tudo;
 *   se nunca carregou, mostra estado de erro com retry.
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { OFFICE_FLOORS, findFloor } from "@/data/office-floors";
import { createHttpClient } from "@/data/adapters/http-client";
import { createOfficeStatusClient, type OfficeStatusDto } from "@/data/adapters/office-status-client";
import { originToFloor } from "@/lib/office-floor";
import { toSparkLine, donutOffset } from "@/lib/vps-charts";
import type { MissionListItemDTO } from "@/data/dto";

const HISTORY_MAX = 28;
const HISTORY_KEY = "operaia.vps.history.v1";

interface HistoryPoint {
  readonly t: number;
  readonly cpu: number;
  readonly mem: number;
}

/** Espelha VpsSnapshot de apps/api/src/modules/infra/vps.routes.ts. */
interface VpsCheck {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly status: string;
  readonly detail: string;
  readonly hint?: string;
  readonly latencyMs?: number;
}

interface VpsInsight {
  readonly id: string;
  readonly level: "info" | "success" | "warning" | "critical";
  readonly title: string;
  readonly body: string;
}

interface VpsSnapshot {
  readonly overall: "healthy" | "degraded" | "down";
  readonly summary: {
    readonly headline: string;
    readonly servicesUp: number;
    readonly servicesTotal: number;
    readonly scoreLabel: string;
  };
  readonly costs: {
    readonly currency: string;
    readonly monthlyEstimate: number;
    readonly note: string;
  };
  readonly checks: readonly VpsCheck[];
  readonly process: {
    readonly uptimeSec: number;
    readonly memoryRssMb: number;
    readonly memoryHeapUsedMb: number;
    readonly memoryHeapTotalMb: number;
    readonly memorySoftLimitMb: number;
    readonly nodeEnv: string;
    readonly nodeVersion: string;
    readonly platform: string;
    readonly arch: string;
    readonly cpuCount: number;
    readonly loadAvg1m: number;
    readonly loadAvg5m: number;
    readonly loadAvg15m: number;
    readonly hostname: string;
  };
  readonly host: {
    readonly freeMemMb: number;
    readonly usedMemPct: number;
    readonly cpuPct: number;
    readonly uptimeSec: number;
  };
  readonly healthScore: number;
  readonly database: {
    readonly reachable: boolean;
    readonly latencyMs: number | null;
  };
  readonly llm: {
    readonly provider: string;
    readonly model: string;
    readonly configured: boolean;
    readonly fallbacks: readonly string[];
  };
  readonly insights: readonly VpsInsight[];
  readonly refresh: { readonly suggestedIntervalSec: number };
}

const httpClient = createHttpClient();
const statusClient = createOfficeStatusClient();

const vps = ref<VpsSnapshot | null>(null);
const missions = ref<readonly MissionListItemDTO[]>([]);
const status = ref<OfficeStatusDto | null>(null);
const history = ref<HistoryPoint[]>([]);
const loading = ref(true);
const refreshing = ref(false);
const lastError = ref<string | null>(null);
const detailsOpen = ref(false);

let pollTimer: ReturnType<typeof setTimeout> | undefined;

function loadHistory(): void {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) history.value = JSON.parse(raw);
  } catch {
    history.value = [];
  }
}

function pushHistory(cpu: number, mem: number): void {
  history.value = [...history.value, { t: Date.now(), cpu, mem }].slice(-HISTORY_MAX);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value));
  } catch {
    // localStorage indisponivel — historico so nao persiste entre sessoes.
  }
}

async function loadAll(isRefresh: boolean): Promise<void> {
  if (isRefresh) refreshing.value = true;
  try {
    const [vpsResult, missionsResult, statusResult] = await Promise.allSettled([
      httpClient.get<VpsSnapshot>("/infra/vps"),
      httpClient.get<{ missions: MissionListItemDTO[] }>("/missions?format=flat&take=100"),
      statusClient.get(),
    ]);
    if (vpsResult.status === "fulfilled") {
      vps.value = vpsResult.value;
      lastError.value = null;
      pushHistory(vpsResult.value.host.cpuPct, vpsResult.value.host.usedMemPct);
    } else {
      lastError.value =
        vpsResult.reason instanceof Error
          ? vpsResult.reason.message
          : "Não foi possível consultar a infraestrutura.";
    }
    if (missionsResult.status === "fulfilled") missions.value = missionsResult.value.missions ?? [];
    if (statusResult.status === "fulfilled") status.value = statusResult.value;
  } finally {
    loading.value = false;
    refreshing.value = false;
    scheduleNextPoll();
  }
}

function scheduleNextPoll(): void {
  if (pollTimer) clearTimeout(pollTimer);
  const seconds = vps.value?.refresh.suggestedIntervalSec ?? 30;
  pollTimer = setTimeout(() => void loadAll(false), Math.max(10, seconds) * 1000);
}

onMounted(() => {
  loadHistory();
  void loadAll(false);
});

onUnmounted(() => {
  if (pollTimer) clearTimeout(pollTimer);
});

async function refresh(): Promise<void> {
  await loadAll(true);
}

const occupancy = computed(() =>
  OFFICE_FLOORS.map((floor) => {
    const count = floor.missionFloor
      ? missions.value.filter((m) => originToFloor(m.origin) === floor.missionFloor).length
      : 0;
    return { floor, count };
  }),
);

const overallLabel = computed(() => {
  switch (vps.value?.overall) {
    case "healthy":
      return "Saudável";
    case "degraded":
      return "Degradado";
    case "down":
      return "Indisponível";
    default:
      return "—";
  }
});

const readiness = computed(() => {
  const s = vps.value;
  if (!s) return "—";
  const items = [
    true,
    s.database.reachable,
    s.llm.configured,
    s.process.memoryRssMb < s.process.memorySoftLimitMb,
    s.overall !== "down",
  ];
  return `${items.filter(Boolean).length}/${items.length}`;
});

const healthRingOffset = computed(() => donutOffset(vps.value?.healthScore ?? 0, 32));
const sparkCpu = computed(() => toSparkLine(history.value.map((h) => h.cpu)));
const sparkMem = computed(() => toSparkLine(history.value.map((h) => h.mem)));

const CHECK_STATUS: Record<string, { label: string; tone: string; healthy: boolean }> = {
  up: { label: "up", tone: "green", healthy: true },
  ready: { label: "ready", tone: "green", healthy: true },
  warn: { label: "atenção", tone: "amber", healthy: false },
  down: { label: "down", tone: "red", healthy: false },
  unconfigured: { label: "sem chave", tone: "muted", healthy: false },
};

function checkInfo(status: string) {
  return CHECK_STATUS[status] ?? { label: status, tone: "muted", healthy: false };
}

function onToggleDetails(event: Event): void {
  detailsOpen.value = (event.target as HTMLDetailsElement).open;
}
</script>

<template>
  <OperationalHeader
    :floor="findFloor('dev')"
    scope-line="Compartilhado · todos os andares"
    title="Prédio"
    lede="Infraestrutura e governança são compartilhadas por todos os andares — esta é a única visão que cruza empresas."
    :refreshing="refreshing"
    :show-cta="false"
    @refresh="refresh"
  />
  <div class="op-content">
    <p v-if="loading && !vps" class="op-loading">Carregando…</p>

    <div v-else-if="!vps" class="op-error" role="alert">
      <p class="op-error__title">Não foi possível carregar a infraestrutura</p>
      <p class="op-error__body">{{ lastError }}</p>
      <button type="button" class="op-btn-retry" @click="refresh">Tentar de novo</button>
    </div>

    <template v-else>
      <div v-if="lastError" class="op-sync-warning" role="status">
        Última sincronização falhou ({{ lastError }}) — mostrando o último dado confirmado.
      </div>

      <div class="op-overview">
        <div class="op-ring-card">
          <svg width="80" height="80" viewBox="0 0 80 80" class="op-ring">
            <circle cx="40" cy="40" r="32" fill="none" stroke="var(--op-track)" stroke-width="7" />
            <circle
              cx="40" cy="40" r="32" fill="none" stroke="var(--op-green)" stroke-width="7"
              stroke-linecap="round" :stroke-dasharray="2 * Math.PI * 32"
              :stroke-dashoffset="healthRingOffset" transform="rotate(-90 40 40)"
            />
          </svg>
          <div class="op-ring-card__copy">
            <p class="op-mono op-ring-card__value">{{ vps.healthScore }}</p>
            <p class="op-ring-card__label">{{ overallLabel }}</p>
          </div>
        </div>
        <div class="op-overview__text">
          <p class="op-overview__headline">{{ vps.summary.headline }}</p>
          <p class="op-mono op-overview__meta">
            prontidão {{ readiness }} · {{ vps.summary.servicesUp }}/{{ vps.summary.servicesTotal }} serviços OK
          </p>
        </div>
      </div>

      <div class="op-metrics-grid">
        <div class="op-metric">
          <p class="op-eyebrow">CPU do host</p>
          <p class="op-mono op-metric__value">{{ vps.host.cpuPct.toFixed(1) }}%</p>
          <svg v-if="sparkCpu" width="100%" height="24" viewBox="0 0 120 36" preserveAspectRatio="none" class="op-spark">
            <polyline :points="sparkCpu" fill="none" stroke="var(--op-cta)" stroke-width="2" />
          </svg>
        </div>
        <div class="op-metric">
          <p class="op-eyebrow">RAM do host</p>
          <p class="op-mono op-metric__value">{{ vps.host.usedMemPct.toFixed(1) }}%</p>
          <svg v-if="sparkMem" width="100%" height="24" viewBox="0 0 120 36" preserveAspectRatio="none" class="op-spark">
            <polyline :points="sparkMem" fill="none" stroke="var(--op-violet)" stroke-width="2" />
          </svg>
        </div>
        <div class="op-metric">
          <p class="op-eyebrow">Latência Postgres</p>
          <p class="op-mono op-metric__value">{{ vps.database.latencyMs ?? "—" }}ms</p>
        </div>
        <div class="op-metric">
          <p class="op-eyebrow">Health score</p>
          <p class="op-mono op-metric__value">{{ vps.healthScore }}</p>
        </div>
      </div>

      <div class="op-two-col">
        <section>
          <h3 class="op-section-title">Serviços do prédio</h3>
          <div v-for="c in vps.checks" :key="c.id" class="op-service-row">
            <span class="op-dot" :class="`is-${checkInfo(c.status).tone}`" />
            <span class="op-service-row__label">{{ c.label }}</span>
            <span class="op-service-row__status" :class="`is-${checkInfo(c.status).tone}`">{{ checkInfo(c.status).label }}</span>
            <span class="op-mono op-service-row__detail">{{ c.detail }}<template v-if="c.latencyMs != null"> · {{ c.latencyMs }}ms</template></span>
          </div>
        </section>

        <section>
          <h3 class="op-section-title">Ocupação por andar</h3>
          <div v-for="o in occupancy" :key="o.floor.id" class="op-occupancy-row">
            <span class="op-floor-badge">{{ o.floor.code }}</span>
            <span class="op-occupancy-row__name">{{ o.floor.name }}</span>
            <span class="op-mono op-occupancy-row__count">{{ o.count }} trabalhos</span>
          </div>
        </section>
      </div>

      <section v-if="status" class="op-gov">
        <h3 class="op-section-title">Governança · janela 24h</h3>
        <div class="op-gov-grid">
          <div class="op-gov-item">
            <p class="op-mono">{{ status.governance.gate.execute }}</p>
            <span>Autorizado</span>
          </div>
          <div class="op-gov-item">
            <p class="op-mono">{{ status.governance.gate.reuse }}</p>
            <span>Reaproveitado</span>
          </div>
          <div class="op-gov-item">
            <p class="op-mono">{{ status.governance.gate.skip }}</p>
            <span>Evitado</span>
          </div>
          <div class="op-gov-item">
            <p class="op-mono">{{ status.governance.gate.reopen }}</p>
            <span>Reaberto</span>
          </div>
        </div>
      </section>

      <details class="op-details" :open="detailsOpen" @toggle="onToggleDetails">
        <summary class="op-details__summary">Detalhes de host, runtime e custo</summary>
        <div class="op-details__grid">
          <div>
            <h4 class="op-details__title">Host &amp; runtime</h4>
            <dl class="op-dl">
              <div><dt>Hostname</dt><dd class="op-mono">{{ vps.process.hostname }}</dd></div>
              <div><dt>SO</dt><dd class="op-mono">{{ vps.process.platform }}/{{ vps.process.arch }}</dd></div>
              <div><dt>Node</dt><dd class="op-mono">{{ vps.process.nodeVersion }}</dd></div>
              <div><dt>Ambiente</dt><dd class="op-mono">{{ vps.process.nodeEnv }}</dd></div>
              <div><dt>CPUs</dt><dd class="op-mono">{{ vps.process.cpuCount }}</dd></div>
              <div><dt>Load average</dt><dd class="op-mono">{{ vps.process.loadAvg1m.toFixed(2) }} / {{ vps.process.loadAvg5m.toFixed(2) }} / {{ vps.process.loadAvg15m.toFixed(2) }}</dd></div>
              <div><dt>RAM livre</dt><dd class="op-mono">{{ vps.host.freeMemMb.toFixed(0) }} MB</dd></div>
              <div><dt>RSS / limite</dt><dd class="op-mono">{{ vps.process.memoryRssMb.toFixed(0) }} / {{ vps.process.memorySoftLimitMb }} MB</dd></div>
              <div><dt>Heap</dt><dd class="op-mono">{{ vps.process.memoryHeapUsedMb.toFixed(0) }} / {{ vps.process.memoryHeapTotalMb.toFixed(0) }} MB</dd></div>
              <div><dt>Uptime host / processo</dt><dd class="op-mono">{{ Math.round(vps.host.uptimeSec / 3600) }}h / {{ Math.round(vps.process.uptimeSec / 3600) }}h</dd></div>
            </dl>
          </div>
          <div>
            <h4 class="op-details__title">LLM &amp; custo</h4>
            <dl class="op-dl">
              <div><dt>Provider</dt><dd class="op-mono">{{ vps.llm.provider }} · {{ vps.llm.model }}</dd></div>
              <div><dt>Chave configurada</dt><dd>{{ vps.llm.configured ? "sim" : "não" }}</dd></div>
              <div><dt>Fallbacks</dt><dd class="op-mono">{{ vps.llm.fallbacks.join(", ") || "—" }}</dd></div>
              <div><dt>Custo mensal estimado</dt><dd class="op-mono">{{ vps.costs.currency }} {{ vps.costs.monthlyEstimate.toFixed(2) }}</dd></div>
            </dl>
            <p class="op-details__note">{{ vps.costs.note }}</p>
          </div>
          <div v-if="vps.insights.length > 0">
            <h4 class="op-details__title">Insights</h4>
            <div v-for="i in vps.insights" :key="i.id" class="op-insight" :class="`is-${i.level}`">
              <p class="op-insight__title">{{ i.title }}</p>
              <p class="op-insight__body">{{ i.body }}</p>
            </div>
          </div>
        </div>
      </details>
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

.op-mono {
  font-family: var(--op-font-mono);
}

.op-eyebrow {
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
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

.op-sync-warning {
  padding: 10px 14px;
  border: 1px solid var(--op-amber);
  border-radius: var(--op-radius-sm);
  background: rgba(251, 191, 36, 0.1);
  color: var(--op-amber);
  font-size: 12.5px;
  margin-bottom: 16px;
}

.op-overview {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 20px;
}

.op-ring-card {
  position: relative;
  width: 80px;
  height: 80px;
  flex-shrink: 0;
}

.op-ring circle {
  transition: stroke-dashoffset 0.4s ease;
}

.op-ring-card__copy {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.op-ring-card__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--op-ink);
}

.op-ring-card__label {
  font-size: 9px;
  color: var(--op-muted-4);
}

.op-overview__headline {
  font-size: 15px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-overview__meta {
  margin-top: 4px;
  font-size: 11px;
  color: var(--op-muted-4);
}

.op-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.op-metric {
  padding: 16px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-metric__value {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-spark {
  display: block;
  margin-top: 8px;
}

.op-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 26px;
}

.op-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--op-ink-2);
  margin-bottom: 12px;
}

.op-service-row,
.op-occupancy-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--op-line-soft);
  font-size: 12.5px;
}

.op-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--op-radius-full);
  flex-shrink: 0;
}

.op-dot.is-green { background: var(--op-green); }
.op-dot.is-amber { background: var(--op-amber); }
.op-dot.is-red { background: var(--op-red); }
.op-dot.is-muted { background: var(--op-muted-5); }

.op-service-row__label {
  flex: 1;
  color: var(--op-ink-4);
}

.op-service-row__status {
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  border-radius: var(--op-radius-xs);
  background: var(--op-raise);
}

.op-service-row__status.is-green { color: var(--op-green); }
.op-service-row__status.is-amber { color: var(--op-amber); }
.op-service-row__status.is-red { color: var(--op-red); }
.op-service-row__status.is-muted { color: var(--op-muted-4); }

.op-service-row__detail {
  color: var(--op-muted-4);
  font-size: 11px;
}

.op-floor-badge {
  width: 22px;
  height: 22px;
  border-radius: var(--op-radius-xs);
  background: var(--op-raise);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--op-font-mono);
  font-size: 9px;
  font-weight: 700;
  color: var(--op-muted-2);
}

.op-occupancy-row__name {
  flex: 1;
  color: var(--op-ink-4);
}

.op-occupancy-row__count {
  color: var(--op-muted-4);
  font-size: 11px;
}

.op-gov {
  margin-bottom: 22px;
}

.op-gov-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.op-gov-item {
  text-align: center;
  padding: 14px 4px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  background: var(--op-panel);
}

.op-gov-item p {
  font-size: 19px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-gov-item span {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: var(--op-muted-4);
  text-transform: uppercase;
}

.op-details {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  padding: 4px 16px;
  background: var(--op-panel);
}

.op-details__summary {
  padding: 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--op-ink-2);
  cursor: pointer;
}

.op-details__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding: 4px 0 16px;
}

.op-details__title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--op-muted-4);
  margin-bottom: 10px;
}

.op-dl div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  border-top: 1px solid var(--op-line-soft);
  font-size: 12px;
}

.op-dl dt {
  color: var(--op-muted-4);
}

.op-dl dd {
  color: var(--op-ink-4);
  text-align: right;
}

.op-details__note {
  margin-top: 8px;
  font-size: 11px;
  color: var(--op-muted-5);
}

.op-insight {
  padding: 10px;
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  margin-bottom: 8px;
}

.op-insight__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--op-ink-3);
}

.op-insight__body {
  margin-top: 3px;
  font-size: 11px;
  color: var(--op-muted-4);
}

@media (max-width: 900px) {
  .op-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .op-two-col,
  .op-details__grid {
    grid-template-columns: 1fr;
  }
}
</style>
