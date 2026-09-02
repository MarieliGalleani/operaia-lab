<script setup lang="ts">
/**
 * Painel VPS — saúde real do host + motion analytics (ref. Olayard / Taqwah).
 * Dados: GET /infra/vps (processo Node + SO + Postgres + LLM).
 */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { createHttpClient } from "@/data/adapters/http-client";
import { donutOffset, toAreaPaths, toSparkLine } from "@/lib/vps-charts";

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
  readonly checkedAt: string;
  readonly overall: "healthy" | "degraded" | "down";
  readonly summary: {
    readonly headline: string;
    readonly servicesUp: number;
    readonly servicesTotal: number;
    readonly scoreLabel: string;
  };
  readonly vps: {
    readonly name: string;
    readonly provider: string;
    readonly region: string;
    readonly role: string;
  };
  readonly costs: {
    readonly currency: string;
    readonly monthlyEstimate: number;
    readonly dailyEstimate: number;
    readonly yearlyEstimate: number;
    readonly status: "none" | "active";
    readonly message: string;
    readonly note: string;
  };
  readonly checks: readonly VpsCheck[];
  readonly process: {
    readonly pid: number;
    readonly uptimeSec: number;
    readonly memoryRssMb: number;
    readonly memoryHeapUsedMb: number;
    readonly memoryHeapTotalMb: number;
    readonly memoryExternalMb: number;
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
    readonly totalMemMb: number;
    readonly freeMemMb: number;
    readonly usedMemMb: number;
    readonly usedMemPct: number;
    readonly cpuPct: number;
    readonly uptimeSec: number;
  };
  readonly healthScore: number;
  readonly database: {
    readonly host: string;
    readonly name: string;
    readonly reachable: boolean;
    readonly latencyMs: number | null;
  };
  readonly llm: {
    readonly provider: string;
    readonly model: string;
    readonly configured: boolean;
    readonly fallbacks: readonly string[];
    readonly observability: boolean;
  };
  readonly insights: readonly VpsInsight[];
  readonly refresh: { readonly suggestedIntervalSec: number };
}

interface HistoryPoint {
  readonly t: number;
  readonly hostMem: number;
  readonly cpu: number;
  readonly rss: number;
  readonly dbMs: number;
}

const HISTORY_MAX = 28;
const HISTORY_KEY = "operaia.vps.history.v1";
const http = createHttpClient();
const router = useRouter();

const loading = ref(true);
const refreshing = ref(false);
const error = ref<string | null>(null);
const snapshot = ref<VpsSnapshot | null>(null);
const secondsToRefresh = ref(12);
const lastFetchMs = ref(0);
const history = ref<HistoryPoint[]>([]);
const chartMode = ref<"hostMem" | "cpu" | "rss">("hostMem");
const entered = ref(false);

let pollTimer: ReturnType<typeof setInterval> | undefined;
let tickTimer: ReturnType<typeof setInterval> | undefined;

const overallLabel = computed(() => {
  switch (snapshot.value?.overall) {
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

const readinessScore = computed(() => {
  const s = snapshot.value;
  if (!s) return "—";
  const items = [
    true,
    s.database.reachable,
    s.llm.configured,
    s.process.memoryRssMb < s.process.memorySoftLimitMb,
    s.overall !== "down",
  ];
  const ok = items.filter(Boolean).length;
  return `${ok}/${items.length}`;
});

const seriesValues = computed(() => {
  const mode = chartMode.value;
  return history.value.map((h) => {
    if (mode === "cpu") return h.cpu;
    if (mode === "rss") return h.rss;
    return h.hostMem;
  });
});

const mainChart = computed(() => toAreaPaths(seriesValues.value, 640, 200));
const sparkCpu = computed(() => toSparkLine(history.value.map((h) => h.cpu)));
const sparkHost = computed(() => toSparkLine(history.value.map((h) => h.hostMem)));
const sparkDb = computed(() => toSparkLine(history.value.map((h) => h.dbMs)));

const chartUnit = computed(() => (chartMode.value === "cpu" ? "%" : chartMode.value === "rss" ? "MB" : "%"));
const chartTitle = computed(() => {
  if (chartMode.value === "cpu") return "CPU do host";
  if (chartMode.value === "rss") return "Memória do processo (RSS)";
  return "RAM do host";
});

const chartLatest = computed(() => {
  const s = snapshot.value;
  if (!s) return "—";
  if (chartMode.value === "cpu") return `${s.host.cpuPct}`;
  if (chartMode.value === "rss") return `${s.process.memoryRssMb}`;
  return `${s.host.usedMemPct}`;
});

const donutStyle = computed(() => {
  const score = snapshot.value?.healthScore ?? 0;
  return { strokeDashoffset: String(donutOffset(score)) };
});

const heapPct = computed(() => {
  const p = snapshot.value?.process;
  if (!p?.memoryHeapTotalMb) return 0;
  return Math.min(100, Math.round((p.memoryHeapUsedMb / p.memoryHeapTotalMb) * 100));
});

const rssPct = computed(() => {
  const p = snapshot.value?.process;
  if (!p?.memorySoftLimitMb) return 0;
  return Math.min(100, Math.round((p.memoryRssMb / p.memorySoftLimitMb) * 100));
});

function money(amount: number, currency = "BRL"): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
  } catch {
    return `R$ ${amount.toFixed(2)}`;
  }
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function statusClass(status: string): string {
  if (status === "up" || status === "ready") return "chip--ok";
  if (status === "warn" || status === "unconfigured") return "chip--warn";
  return "chip--bad";
}

function statusText(status: string): string {
  const map: Record<string, string> = {
    up: "UP",
    down: "DOWN",
    ready: "PRONTO",
    unconfigured: "SEM CHAVE",
    warn: "ATENÇÃO",
  };
  return map[status] ?? status.toUpperCase();
}

function loadHistory(): void {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as HistoryPoint[];
    if (Array.isArray(parsed)) history.value = parsed.slice(-HISTORY_MAX);
  } catch {
    console.log("[vps-panel] histórico local inválido, reiniciando");
  }
}

function saveHistory(): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value.slice(-HISTORY_MAX)));
  } catch {
    /* ignore quota */
  }
}

function go(to: string): void {
  void router.push(to);
}

async function refresh(manual = false): Promise<void> {
  if (manual) refreshing.value = true;
  else if (!snapshot.value) loading.value = true;
  error.value = null;
  const started = performance.now();
  try {
    const data = await http.get<VpsSnapshot>("/infra/vps");
    snapshot.value = data;
    lastFetchMs.value = Math.round(performance.now() - started);
    secondsToRefresh.value = data.refresh.suggestedIntervalSec;
    history.value = [
      ...history.value,
      {
        t: Date.now(),
        hostMem: data.host.usedMemPct,
        cpu: data.host.cpuPct,
        rss: data.process.memoryRssMb,
        dbMs: data.database.latencyMs ?? 0,
      },
    ].slice(-HISTORY_MAX);
    saveHistory();
    console.log(
      "[vps-panel] overall=",
      data.overall,
      "score=",
      data.healthScore,
      "cpu=",
      data.host.cpuPct,
      "hostMem%=",
      data.host.usedMemPct,
    );
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Falha ao carregar painel da VPS";
    console.log("[vps-panel] erro:", error.value);
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

watch(
  () => snapshot.value?.checkedAt,
  () => {
    if (snapshot.value) entered.value = true;
  },
);

onMounted(async () => {
  loadHistory();
  await refresh();
  const intervalSec = snapshot.value?.refresh.suggestedIntervalSec ?? 12;
  pollTimer = setInterval(() => void refresh(), intervalSec * 1000);
  tickTimer = setInterval(() => {
    secondsToRefresh.value = Math.max(0, secondsToRefresh.value - 1);
  }, 1000);
  requestAnimationFrame(() => {
    entered.value = true;
  });
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (tickTimer) clearInterval(tickTimer);
});
</script>

<template>
  <div class="page vps" :class="{ 'vps--ready': entered && snapshot }">
    <header class="vps__header">
      <div>
        <p class="vps__kicker">Live analytics · saúde real do host</p>
        <h1 class="page__title">Painel VPS</h1>
        <p class="page__subtitle">
          Telemetria ao vivo da máquina, processo Node, Postgres e LLM — sem dados simulados.
        </p>
      </div>
      <div class="vps__actions">
        <span class="vps__live" :class="{ 'vps__live--busy': loading || refreshing }">
          <span class="vps__pulse" aria-hidden="true" />
          {{ loading && !snapshot ? "Sincronizando…" : `Próxima · ${secondsToRefresh}s` }}
        </span>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="loading || refreshing"
          @click="refresh(true)"
        >
          {{ refreshing ? "Atualizando…" : "Atualizar agora" }}
        </button>
      </div>
    </header>

    <div v-if="loading && !snapshot" class="vps__skeleton" aria-busy="true">
      <div class="skel skel--wide" />
      <div class="skel skel--mid" />
      <div class="skel skel--mid" />
    </div>

    <div v-else-if="error && !snapshot" class="vps__error-panel">
      <h2>API fora do radar</h2>
      <p>{{ error }}</p>
      <p class="vps__error-hint">Suba a API na porta 3333 — este painel depende do heartbeat real.</p>
      <button type="button" class="btn btn--primary" @click="refresh(true)">Tentar novamente</button>
    </div>

    <template v-else-if="snapshot">
      <p v-if="error" class="vps__banner-error">Última sincronização falhou: {{ error }}</p>

      <!-- Top: score + chart + cost (Olayard-like decision row) -->
      <section class="stage">
        <article class="score card-motion" :class="`score--${snapshot.overall}`">
          <p class="eyebrow">Health score</p>
          <div class="score__ring">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle class="score__track" cx="60" cy="60" r="54" />
              <circle
                class="score__fill"
                cx="60"
                cy="60"
                r="54"
                :style="donutStyle"
              />
            </svg>
            <div class="score__value">
              <strong>{{ snapshot.healthScore }}</strong>
              <span>/100</span>
            </div>
          </div>
          <h2 class="score__label">{{ overallLabel }}</h2>
          <p class="score__line">{{ snapshot.summary.headline }}</p>
          <p class="score__meta">
            {{ snapshot.vps.name }} · {{ snapshot.vps.provider }} · {{ snapshot.vps.region }}
          </p>
          <p class="score__meta">Prontidão {{ readinessScore }} · {{ snapshot.summary.scoreLabel }}</p>
        </article>

        <article class="chart card-motion">
          <header class="chart__head">
            <div>
              <p class="eyebrow">Telemetria ao vivo</p>
              <h3>{{ chartTitle }}</h3>
            </div>
            <div class="chart__modes">
              <button
                type="button"
                class="chart__mode"
                :class="{ 'chart__mode--on': chartMode === 'hostMem' }"
                @click="chartMode = 'hostMem'"
              >
                RAM host
              </button>
              <button
                type="button"
                class="chart__mode"
                :class="{ 'chart__mode--on': chartMode === 'cpu' }"
                @click="chartMode = 'cpu'"
              >
                CPU
              </button>
              <button
                type="button"
                class="chart__mode"
                :class="{ 'chart__mode--on': chartMode === 'rss' }"
                @click="chartMode = 'rss'"
              >
                RSS
              </button>
            </div>
          </header>

          <div class="chart__hero">
            <p class="chart__big">
              {{ chartLatest }}<span>{{ chartUnit }}</span>
            </p>
            <p class="chart__hint">
              {{ history.length }} amostras · fetch {{ lastFetchMs }} ms · host {{ snapshot.process.hostname }}
            </p>
          </div>

          <div class="chart__canvas">
            <svg
              v-if="mainChart.line"
              :key="`${chartMode}-${history.length}`"
              class="area"
              viewBox="0 0 640 200"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="vpsAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgba(59,130,246,0.45)" />
                  <stop offset="100%" stop-color="rgba(59,130,246,0)" />
                </linearGradient>
              </defs>
              <path class="area__fill" :d="mainChart.area" fill="url(#vpsAreaFill)" />
              <path class="area__line" :d="mainChart.line" />
            </svg>
            <p v-else class="chart__empty">Coletando série… aguarde a 2ª checagem</p>
            <div class="chart__glow" aria-hidden="true" />
          </div>
        </article>

        <article class="cost-card card-motion">
          <p class="eyebrow">Custo mensal</p>
          <p class="cost-card__value">{{ money(snapshot.costs.monthlyEstimate, snapshot.costs.currency) }}</p>
          <p class="cost-card__msg">{{ snapshot.costs.message }}</p>
          <div class="cost-card__split">
            <div>
              <span>Diário</span>
              <strong>{{ money(snapshot.costs.dailyEstimate, snapshot.costs.currency) }}</strong>
            </div>
            <div>
              <span>Anual</span>
              <strong>{{ money(snapshot.costs.yearlyEstimate, snapshot.costs.currency) }}</strong>
            </div>
          </div>
          <p class="cost-card__note">{{ snapshot.costs.note }}</p>
        </article>
      </section>

      <!-- KPI strip with mini charts -->
      <section class="kpis">
        <article class="kpi card-motion" style="--d: 1">
          <p class="kpi__label">CPU host</p>
          <p class="kpi__value">{{ snapshot.host.cpuPct }}%</p>
          <div class="meter"><span :style="{ width: `${Math.min(100, snapshot.host.cpuPct)}%` }" /></div>
          <svg v-if="sparkCpu" class="mini" viewBox="0 0 120 36" preserveAspectRatio="none">
            <polyline :points="sparkCpu" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
          <p class="kpi__hint">{{ snapshot.process.cpuCount }} CPUs</p>
        </article>

        <article class="kpi card-motion" style="--d: 2">
          <p class="kpi__label">RAM host</p>
          <p class="kpi__value">{{ snapshot.host.usedMemPct }}%</p>
          <div class="meter"><span :style="{ width: `${Math.min(100, snapshot.host.usedMemPct)}%` }" /></div>
          <svg v-if="sparkHost" class="mini mini--ok" viewBox="0 0 120 36" preserveAspectRatio="none">
            <polyline :points="sparkHost" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
          <p class="kpi__hint">{{ snapshot.host.usedMemMb }} / {{ snapshot.host.totalMemMb }} MB</p>
        </article>

        <article class="kpi card-motion" style="--d: 3">
          <p class="kpi__label">RSS processo</p>
          <p class="kpi__value">{{ snapshot.process.memoryRssMb }} MB</p>
          <div class="meter"><span :style="{ width: `${rssPct}%` }" /></div>
          <p class="kpi__hint">{{ rssPct }}% do soft limit · PID {{ snapshot.process.pid }}</p>
        </article>

        <article class="kpi card-motion" style="--d: 4">
          <p class="kpi__label">Heap</p>
          <p class="kpi__value">{{ snapshot.process.memoryHeapUsedMb }} MB</p>
          <div class="meter meter--accent"><span :style="{ width: `${heapPct}%` }" /></div>
          <p class="kpi__hint">de {{ snapshot.process.memoryHeapTotalMb }} MB</p>
        </article>

        <article class="kpi card-motion" style="--d: 5">
          <p class="kpi__label">Postgres</p>
          <p class="kpi__value">
            {{ snapshot.database.reachable ? `${snapshot.database.latencyMs ?? "—"} ms` : "DOWN" }}
          </p>
          <svg v-if="sparkDb" class="mini mini--db" viewBox="0 0 120 36" preserveAspectRatio="none">
            <polyline :points="sparkDb" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
          <p class="kpi__hint">{{ snapshot.database.name }}</p>
        </article>

        <article class="kpi card-motion" style="--d: 6">
          <p class="kpi__label">Uptime</p>
          <p class="kpi__value kpi__value--sm">{{ formatUptime(snapshot.host.uptimeSec) }}</p>
          <p class="kpi__hint">Host · API {{ formatUptime(snapshot.process.uptimeSec) }}</p>
          <p class="kpi__hint">Load {{ snapshot.process.loadAvg1m }} / {{ snapshot.process.loadAvg5m }} / {{ snapshot.process.loadAvg15m }}</p>
        </article>
      </section>

      <!-- Bottom deck -->
      <section class="deck">
        <div class="col card-motion" style="--d: 7">
          <header class="block-head">
            <h3>Serviços vivos</h3>
            <span>{{ snapshot.summary.scoreLabel }}</span>
          </header>
          <article v-for="check in snapshot.checks" :key="check.id" class="svc">
            <div class="svc__top">
              <div>
                <p class="svc__cat">{{ check.category }}</p>
                <h4>{{ check.label }}</h4>
              </div>
              <span class="chip" :class="statusClass(check.status)">{{ statusText(check.status) }}</span>
            </div>
            <p class="svc__detail">{{ check.detail }}</p>
            <p v-if="check.hint" class="svc__hint">{{ check.hint }}</p>
            <p v-if="check.latencyMs != null" class="svc__lat">Latência {{ check.latencyMs }} ms</p>
          </article>
        </div>

        <div class="col card-motion" style="--d: 8">
          <header class="block-head">
            <h3>Host & runtime</h3>
            <span>métricas reais</span>
          </header>
          <div class="row"><span>Hostname</span><strong>{{ snapshot.process.hostname }}</strong></div>
          <div class="row"><span>SO</span><strong>{{ snapshot.process.platform }}/{{ snapshot.process.arch }}</strong></div>
          <div class="row"><span>Node</span><strong>{{ snapshot.process.nodeVersion }}</strong></div>
          <div class="row"><span>Ambiente</span><strong>{{ snapshot.process.nodeEnv }}</strong></div>
          <div class="row"><span>RAM livre</span><strong>{{ snapshot.host.freeMemMb }} MB</strong></div>
          <div class="row"><span>External</span><strong>{{ snapshot.process.memoryExternalMb }} MB</strong></div>
          <div class="row"><span>DB host</span><strong>{{ snapshot.database.host }}</strong></div>
          <div class="row"><span>LLM</span><strong>{{ snapshot.llm.provider }} · {{ snapshot.llm.model }}</strong></div>
          <div class="row"><span>Chave LLM</span><strong>{{ snapshot.llm.configured ? "ok" : "ausente" }}</strong></div>
        </div>

        <div class="col card-motion" style="--d: 9">
          <header class="block-head">
            <h3>Insights</h3>
            <span>decisão rápida</span>
          </header>
          <article
            v-for="insight in snapshot.insights"
            :key="insight.id"
            class="insight"
            :class="`insight--${insight.level}`"
          >
            <p class="insight__title">{{ insight.title }}</p>
            <p class="insight__body">{{ insight.body }}</p>
          </article>

          <div class="ready__actions">
            <button type="button" class="btn btn--ghost" @click="go('/app/campus')">Ir ao Campus</button>
            <button type="button" class="btn btn--primary" @click="go('/app/office/sala-ceo')">Falar com a Opera</button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.vps.page {
  max-width: none;
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 14px 20px 20px;
  display: flex;
  flex-direction: column;
}

.vps__kicker {
  margin-bottom: 6px;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--brand);
}

.vps__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-shrink: 0;
}

.vps .page__subtitle {
  max-width: 56ch;
  font-size: 13px;
}

.vps__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 20px;
}

.vps__actions .btn { margin-top: 10px; }

.vps__live {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: var(--text-muted);
}

.vps__pulse {
  width: 8px;
  height: 8px;
  margin-right: 8px;
  border-radius: 50%;
  background: var(--success);
  animation: pulse 2s var(--ease) infinite;
}

.vps__live--busy .vps__pulse { background: var(--warning); }

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.45); }
  70% { box-shadow: 0 0 0 10px rgba(52, 211, 153, 0); }
  100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
}

.eyebrow {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-soft);
}

.card-motion {
  opacity: 0;
  transform: translateY(14px);
  transition:
    opacity 0.55s var(--ease),
    transform 0.55s var(--ease),
    border-color 0.25s var(--ease),
    box-shadow 0.25s var(--ease);
  transition-delay: calc(var(--d, 0) * 55ms);
}

.vps--ready .card-motion {
  opacity: 1;
  transform: translateY(0);
}

.stage {
  display: grid;
  grid-template-columns: 220px minmax(0, 1.6fr) 220px;
  grid-column-gap: 14px;
  margin-top: 14px;
  flex-shrink: 0;
}

.score,
.chart,
.cost-card,
.kpi,
.col {
  border-radius: 16px;
  border: 1px solid var(--border);
  background:
    linear-gradient(165deg, rgba(30, 48, 80, 0.45), transparent 42%),
    var(--surface);
}

.score {
  padding: 16px;
  text-align: center;
}

.score--healthy { border-color: rgba(52, 211, 153, 0.35); }
.score--degraded { border-color: rgba(251, 191, 36, 0.35); }
.score--down { border-color: rgba(248, 113, 113, 0.4); }

.score__ring {
  position: relative;
  width: 132px;
  height: 132px;
  margin: 14px auto 0;
}

.score__ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.score__track {
  fill: none;
  stroke: var(--surface-2);
  stroke-width: 10;
}

.score__fill {
  fill: none;
  stroke: url(#none);
  stroke: #34d399;
  stroke-width: 10;
  stroke-linecap: round;
  stroke-dasharray: 339.292;
  transition: stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}

.score--degraded .score__fill { stroke: #fbbf24; }
.score--down .score__fill { stroke: #f87171; }
.score--healthy .score__fill { stroke: #34d399; }

.score__value {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.score__value strong {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
}

.score__value span {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-soft);
}

.score__label {
  margin-top: 12px;
  font-size: 22px;
  font-weight: 700;
}

.score__line { margin-top: 6px; font-size: 13px; color: var(--text); }
.score__meta { margin-top: 6px; font-size: 11px; color: var(--text-muted); }

.chart {
  padding: 16px 18px 12px;
  position: relative;
  overflow: hidden;
}

.chart__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.chart__head h3 {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
}

.chart__modes {
  display: flex;
}

.chart__mode {
  margin-left: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s var(--ease), color 0.2s var(--ease), border-color 0.2s var(--ease);
}

.chart__mode--on {
  background: rgba(59, 130, 246, 0.18);
  border-color: var(--brand-line);
  color: var(--text);
}

.chart__hero { margin-top: 10px; }

.chart__big {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1;
}

.chart__big span {
  margin-left: 6px;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-muted);
}

.chart__hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-soft);
}

.chart__canvas {
  position: relative;
  margin-top: 8px;
  height: 168px;
}

.area {
  width: 100%;
  height: 100%;
}

.area__line {
  fill: none;
  stroke: #60a5fa;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 6px rgba(96, 165, 250, 0.35));
  stroke-dasharray: 1200;
  stroke-dashoffset: 1200;
  animation: drawLine 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.area__fill {
  opacity: 0;
  animation: fadeFill 0.9s ease 0.25s forwards;
}

@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}

@keyframes fadeFill {
  to { opacity: 1; }
}

.chart__empty {
  padding: 48px 0;
  text-align: center;
  color: var(--text-soft);
  font-size: 13px;
}

.chart__glow {
  pointer-events: none;
  position: absolute;
  right: -20%;
  top: -30%;
  width: 55%;
  height: 70%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.12), transparent 65%);
  animation: floatGlow 6s ease-in-out infinite;
}

@keyframes floatGlow {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-12px, 10px); }
}

.cost-card {
  padding: 16px;
}

.cost-card__value {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 700;
}

.cost-card__msg {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.cost-card__split {
  display: flex;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.cost-card__split > div {
  flex: 1;
}

.cost-card__split > div + div {
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--border);
}

.cost-card__split span {
  display: block;
  font-size: 11px;
  color: var(--text-soft);
}

.cost-card__split strong {
  display: block;
  margin-top: 4px;
  font-size: 14px;
}

.cost-card__note {
  margin-top: 14px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-soft);
}

.kpis {
  display: flex;
  flex-wrap: wrap;
  margin-top: 4px;
  flex-shrink: 0;
}

.kpi {
  width: calc(16.666% - 10px);
  margin-top: 12px;
  margin-right: 12px;
  padding: 12px;
}

.kpi:nth-child(6n) { margin-right: 0; }

.kpi__label {
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-soft);
}

.kpi__value {
  margin-top: 6px;
  font-size: 20px;
  font-weight: 700;
}

.kpi__value--sm { font-size: 16px; }
.kpi__hint { margin-top: 6px; font-size: 11px; color: var(--text-muted); }

.meter {
  margin-top: 8px;
  height: 5px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}

.meter span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--brand), #60a5fa);
  transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}

.meter--accent span {
  background: linear-gradient(90deg, var(--accent), #38bdf8);
}

.mini {
  width: 100%;
  height: 28px;
  margin-top: 8px;
  color: var(--brand);
}

.mini--ok { color: var(--success); }
.mini--db { color: var(--accent); }

.deck {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-column-gap: 14px;
  margin-top: 14px;
  flex: 1;
  align-items: stretch;
}

.col {
  padding: 14px;
  min-height: 0;
}

.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.block-head h3 { font-size: 15px; font-weight: 600; }
.block-head span { font-size: 11px; color: var(--text-soft); }

.svc {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--glass);
  transition: transform 0.2s var(--ease), border-color 0.2s var(--ease);
}

.svc:first-child { margin-top: 0; }
.svc:hover {
  transform: translateY(-2px);
  border-color: var(--brand-line);
}

.svc__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.svc__cat {
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-soft);
}

.svc h4 { margin-top: 3px; font-size: 13px; font-weight: 600; }
.svc__detail { margin-top: 6px; font-size: 12px; color: var(--text-muted); }
.svc__hint { margin-top: 4px; font-size: 11px; color: var(--text-soft); }
.svc__lat { margin-top: 6px; font-size: 11px; color: var(--accent); }

.chip {
  margin-left: 8px;
  padding: 3px 7px;
  border-radius: 6px;
  border: 1px solid var(--border);
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.chip--ok { color: var(--success); background: var(--success-soft); border-color: rgba(52, 211, 153, 0.25); }
.chip--warn { color: var(--warning); background: var(--warning-soft); border-color: rgba(251, 191, 36, 0.25); }
.chip--bad { color: var(--danger); background: var(--danger-soft); border-color: rgba(248, 113, 113, 0.25); }

.row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}

.row:last-child { border-bottom: none; }
.row span { color: var(--text-muted); margin-right: 10px; }
.row strong { color: var(--text); text-align: right; word-break: break-all; }

.insight {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
}

.insight--success { background: var(--success-soft); border-color: rgba(52, 211, 153, 0.22); }
.insight--warning { background: var(--warning-soft); border-color: rgba(251, 191, 36, 0.22); }
.insight--critical { background: var(--danger-soft); border-color: rgba(248, 113, 113, 0.25); }
.insight--info { background: var(--info-soft); }

.insight__title { font-size: 13px; font-weight: 600; }
.insight__body { margin-top: 4px; font-size: 12px; color: var(--text-muted); line-height: 1.4; }

.ready__actions {
  display: flex;
  margin-top: 14px;
}

.ready__actions .btn { flex: 1; }
.ready__actions .btn + .btn { margin-left: 8px; }

.vps__banner-error {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 13px;
}

.vps__error-panel {
  margin-top: 24px;
  padding: 28px;
  border-radius: var(--radius);
  border: 1px solid rgba(248, 113, 113, 0.3);
  background: var(--danger-soft);
}

.vps__error-panel h2 { font-size: 22px; }
.vps__error-panel p { margin-top: 8px; color: var(--text-muted); font-size: 14px; }
.vps__error-hint { margin-bottom: 16px; }

.vps__skeleton {
  display: flex;
  flex-wrap: wrap;
  margin-top: 20px;
}

.skel {
  border-radius: var(--radius);
  background: linear-gradient(90deg, var(--surface), var(--surface-2), var(--surface));
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
}

.skel--wide { width: 100%; height: 220px; }
.skel--mid {
  width: calc(50% - 8px);
  height: 160px;
  margin-top: 14px;
  margin-right: 16px;
}
.skel--mid:last-child { margin-right: 0; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 1200px) {
  .stage {
    grid-template-columns: 1fr 1fr;
  }
  .chart { grid-column: 1 / -1; }
  .kpi {
    width: calc(33.333% - 8px);
  }
  .kpi:nth-child(6n) { margin-right: 12px; }
  .kpi:nth-child(3n) { margin-right: 0; }
}

@media (max-width: 960px) {
  .stage,
  .deck {
    grid-template-columns: 1fr;
    grid-row-gap: 12px;
  }
  .kpi,
  .skel--mid {
    width: 100%;
    margin-right: 0;
  }
}

@media (max-width: 720px) {
  .vps.page { padding: 12px; }
  .vps__header { flex-direction: column; }
  .vps__actions { align-items: flex-start; margin-left: 0; margin-top: 12px; }
  .chart__head { flex-direction: column; }
  .chart__modes { margin-top: 10px; }
  .chart__mode { margin-left: 0; margin-right: 6px; }
  .ready__actions { flex-direction: column; }
  .ready__actions .btn + .btn { margin-left: 0; margin-top: 8px; }
}
</style>
