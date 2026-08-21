<script setup lang="ts">
/**
 * Porta de entrada do escritório — Status READ-ONLY, determinístico, sem LLM.
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { createHttpClient, HttpError } from "@/data/adapters/http-client";
import type { OfficeLevel, OfficeStatusDto } from "@/data/office-status";

const POLL_MS = 30_000;
const http = createHttpClient();

const state = ref<"loading" | "ready" | "error">("loading");
const data = ref<OfficeStatusDto | null>(null);
const errorMessage = ref("Não foi possível atualizar o estado do escritório.");
const showGateDetail = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

const levelMeta: Record<
  OfficeLevel,
  { chip: string; tone: string; label: string }
> = {
  OPERATING: { chip: "chip--ok", tone: "ok", label: "OPERANDO" },
  ATTENTION: { chip: "chip--warn", tone: "warn", label: "ATENÇÃO" },
  PROBLEM: { chip: "chip--bad", tone: "bad", label: "PROBLEMA" },
};

const severityLabel: Record<string, string> = {
  blocker: "Bloqueio",
  critical: "Crítico",
  warning: "Alerta",
  info: "Informação",
};

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia, Marieli";
  if (h < 18) return "Boa tarde, Marieli";
  return "Boa noite, Marieli";
});

const level = computed(() => data.value?.status.level ?? "OPERATING");
const meta = computed(() => levelMeta[level.value]);

const humanSummary = computed(() => {
  const d = data.value;
  if (!d) return "";
  if (d.status.level === "OPERATING") {
    return "O escritório está saudável e funcionando normalmente.";
  }
  if (d.status.level === "ATTENTION") {
    return "O escritório opera, mas há algo que merece o seu olhar.";
  }
  return "Há um problema operacional que precisa de atenção.";
});

const nowMessage = computed(() => {
  const a = data.value?.activity;
  if (!a) return "";
  if (a.idle) return "Neste momento, não há trabalho pendente.";
  if (a.missionsRunning > 0) {
    return a.missionsRunning === 1
      ? "1 trabalho em andamento."
      : `${a.missionsRunning} trabalhos em andamento.`;
  }
  if (a.missionsQueued > 0) return "Há trabalho na fila.";
  return a.message;
});

const attentionItems = computed(() => {
  const items = data.value?.attention.items ?? [];
  return items.filter((item) => {
    if (item.code === "failed_new") {
      return (data.value?.attention.failed.newInWindow ?? 0) > 0;
    }
    return true;
  });
});

const showFailedDebt = computed(() => {
  const f = data.value?.attention.failed;
  return f != null && f.newInWindow > 0;
});

const gateLines = computed(() => {
  const g = data.value?.governance.gate;
  if (!g) return [] as string[];
  const lines: string[] = [];
  if (g.execute > 0) {
    lines.push(
      g.execute === 1
        ? "1 trabalho foi autorizado."
        : `${g.execute} trabalhos foram autorizados.`,
    );
  }
  if (g.skip > 0) {
    lines.push(
      g.skip === 1
        ? "1 trabalho foi evitado porque já existia."
        : `${g.skip} trabalhos foram evitados porque já existiam.`,
    );
  }
  if (g.reuse > 0) {
    lines.push(
      g.reuse === 1
        ? "1 resultado anterior foi reaproveitado."
        : `${g.reuse} resultados anteriores foram reaproveitados.`,
    );
  }
  if (g.reopen > 0) {
    lines.push(
      g.reopen === 1
        ? "1 trabalho foi reaberto."
        : `${g.reopen} trabalhos foram reabertos.`,
    );
  }
  return lines;
});

const policyLine = computed(() => {
  const p = data.value?.governance.policy;
  if (!p) return "";
  const parts: string[] = [];
  if (p.convertCandidateInWindow > 0) {
    parts.push(`${p.convertCandidateInWindow} sinal(is) convertidos`);
  }
  if (p.deferInWindow > 0) {
    parts.push(`${p.deferInWindow} adiados`);
  }
  if (p.ignoreInWindow > 0) {
    parts.push(`${p.ignoreInWindow} ignorados`);
  }
  return parts.length ? `Sinais nas últimas 24h: ${parts.join(" · ")}.` : "";
});

const teamLine = computed(() => {
  const w = data.value?.status.workers;
  if (!w) return "";
  return `${w.alive} de ${w.expected} pessoas da equipe ativas`;
});

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
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

function humanDecision(decision: string): string {
  const d = decision.toUpperCase();
  if (d === "EXECUTE") return "Autorizado";
  if (d === "SKIP") return "Evitado";
  if (d === "REUSE") return "Reaproveitado";
  if (d === "REOPEN") return "Reaberto";
  return decision;
}

async function load(): Promise<void> {
  console.log("[office-status] carregando agregador");
  try {
    const next = await http.get<OfficeStatusDto>("/office/status");
    data.value = next;
    state.value = "ready";
    console.log("[office-status] ok", { level: next.status.level });
  } catch (error) {
    console.log("[office-status] erro", error);
    errorMessage.value =
      error instanceof HttpError && error.status === 401
        ? "Sessão expirada. Entre novamente."
        : "Não foi possível atualizar o estado do escritório.";
    if (!data.value) state.value = "error";
  }
}

onMounted(() => {
  void load();
  timer = setInterval(() => {
    void load();
  }, POLL_MS);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  timer = null;
});
</script>

<template>
  <div class="office-status">
    <header class="studio__topbar office-status__top">
      <div class="topbar__left">
        <p class="page__kicker">
          <span class="live-dot" aria-hidden="true" />
          Porta do escritório
        </p>
        <h1 class="page__title">Status</h1>
      </div>
      <div class="topbar__right">
        <button
          type="button"
          class="btn btn--ghost"
          :disabled="state === 'loading' && !data"
          @click="load"
        >
          Atualizar
        </button>
      </div>
    </header>

    <div
      v-if="state === 'loading' && !data"
      class="studio__stage office-status__stage"
      role="status"
      aria-busy="true"
      aria-label="Carregando estado do escritório"
    >
      <section class="panel office-status__hero office-status__skeleton">
        <div class="skel skel--lg" />
        <div class="skel skel--md" />
      </section>
    </div>

    <div
      v-else-if="state === 'error' && !data"
      class="studio__stage office-status__stage"
      role="alert"
    >
      <section class="panel office-status__error">
        <p class="office-status__error-title">Estado indisponível</p>
        <p>{{ errorMessage }}</p>
        <button type="button" class="btn btn--primary" @click="load">
          Tentar de novo
        </button>
      </section>
    </div>

    <div v-else-if="data" class="studio__stage office-status__stage">
      <p
        v-if="data.degradations.length"
        class="office-status__degrade"
        role="status"
      >
        {{ data.degradations.join(" ") }}
      </p>

      <!-- HERO -->
      <section
        class="office-status__hero"
        :class="`office-status__hero--${meta.tone}`"
        aria-labelledby="office-status-heading"
      >
        <p class="office-status__greet">{{ greeting }}</p>
        <p class="office-status__lead-line">Seu escritório está…</p>
        <h2 id="office-status-heading" class="office-status__level">
          <span class="chip" :class="meta.chip" aria-hidden="true">●</span>
          {{ meta.label }}
        </h2>
        <p class="office-status__summary">{{ humanSummary }}</p>
        <p class="office-status__meta">
          {{ teamLine }}
          <span v-if="data.status.supervisor.running">
            · última ronda {{ formatWhen(data.status.supervisor.lastSnapshotAt) }}
          </span>
          · atualizado {{ formatWhen(data.generatedAt) }}
        </p>
        <div class="sr-only" aria-live="polite" aria-atomic="true">
          Estado do escritório: {{ meta.label }}. {{ humanSummary }}
        </div>
      </section>

      <!-- PRECISA DE VOCÊ -->
      <section
        v-if="data.humanAction.needed"
        class="panel office-status__human office-status__human--need"
        aria-labelledby="office-human"
      >
        <p class="eyebrow">Precisa de você</p>
        <h2 id="office-human" class="section__title">
          {{ data.humanAction.message }}
        </h2>
        <ul class="office-status__list">
          <li v-for="p in data.humanAction.proposals" :key="p.id">
            <strong>{{ p.title }}</strong>
            <span class="muted"> · {{ formatWhen(p.createdAt) }}</span>
          </li>
        </ul>
      </section>
      <p
        v-else
        class="office-status__quiet"
        role="status"
      >
        Por enquanto, a OperaIA não precisa de você.
      </p>

      <!-- AGORA + ATENÇÃO -->
      <div class="office-status__main">
        <section class="panel office-status__block" aria-labelledby="office-now">
          <p class="eyebrow">Agora</p>
          <h2 id="office-now" class="section__title">O que está acontecendo</h2>
          <p class="office-status__lead">{{ nowMessage }}</p>
          <p v-if="!data.activity.idle" class="office-status__note">
            Fila: {{ data.activity.missionsQueued }}
            · Em execução: {{ data.activity.missionsRunning }}
            · Equipe ocupada: {{ data.activity.workersBusy }}
          </p>
          <ul
            v-if="data.activity.runningObjectives.length"
            class="office-status__list"
          >
            <li
              v-for="item in data.activity.runningObjectives"
              :key="item.id"
            >
              {{ item.objective }}
            </li>
          </ul>
        </section>

        <section
          class="panel office-status__block"
          aria-labelledby="office-attention"
        >
          <p class="eyebrow">Atenção</p>
          <h2 id="office-attention" class="section__title">
            Riscos e alertas
          </h2>
          <p
            v-if="!attentionItems.length"
            class="office-status__lead"
          >
            Não há nada que precise da sua atenção agora.
          </p>
          <ul v-else class="office-status__attention">
            <li
              v-for="item in attentionItems"
              :key="item.code + item.title"
              :class="`sev--${item.severity}`"
            >
              <span class="sev-label">
                {{ severityLabel[item.severity] ?? item.severity }}
              </span>
              <strong>{{ item.title }}</strong>
              <span>{{ item.detail }}</span>
            </li>
          </ul>
          <p v-if="showFailedDebt" class="office-status__note">
            Falhas novas nas últimas 24h:
            {{ data.attention.failed.newInWindow }}
            (histórico acumulado não conta como problema atual).
          </p>
        </section>
      </div>

      <!-- DECISÕES + CONCLUÍDO -->
      <div class="office-status__main">
        <section
          class="panel office-status__block"
          aria-labelledby="office-decisions"
        >
          <p class="eyebrow">Enquanto você estava fora · 24h</p>
          <h2 id="office-decisions" class="section__title">
            O que a OperaIA decidiu
          </h2>
          <p
            v-if="data.sources.gate === 'error'"
            class="office-status__lead"
            role="status"
          >
            Dados de decisões temporariamente indisponíveis.
          </p>
          <template v-else>
            <ul
              v-if="gateLines.length"
              class="office-status__human-list"
            >
              <li v-for="(line, i) in gateLines" :key="i">{{ line }}</li>
            </ul>
            <p v-else class="office-status__lead">
              Nenhuma decisão de admissão registrada nas últimas 24h.
            </p>
            <p v-if="policyLine" class="office-status__note">{{ policyLine }}</p>
            <button
              v-if="data.governance.gate.recent.length"
              type="button"
              class="office-status__detail-btn"
              :aria-expanded="showGateDetail"
              @click="showGateDetail = !showGateDetail"
            >
              {{ showGateDetail ? "Ocultar detalhes" : "Ver detalhes técnicos" }}
            </button>
            <ul
              v-if="showGateDetail"
              class="office-status__list"
            >
              <li
                v-for="(row, idx) in data.governance.gate.recent"
                :key="idx"
              >
                <strong>{{ humanDecision(row.decision) }}</strong>
                · {{ row.reason }}
                <span class="muted"> · {{ formatWhen(row.createdAt) }}</span>
              </li>
            </ul>
          </template>
        </section>

        <section
          class="panel office-status__block"
          aria-labelledby="office-done"
        >
          <p class="eyebrow">Concluído · 24h</p>
          <h2 id="office-done" class="section__title">O que foi resolvido</h2>
          <p
            v-if="!data.completed.items.length"
            class="office-status__lead"
          >
            Ainda não há entregas recentes para mostrar.
          </p>
          <ul v-else class="office-status__list">
            <li
              v-for="item in data.completed.items.slice(0, 5)"
              :key="item.id"
            >
              <router-link
                :to="`/app/office/missions/${item.id}`"
                class="office-status__link"
              >
                {{ item.title }}
              </router-link>
              <span class="muted"> · {{ formatWhen(item.finishedAt) }}</span>
            </li>
          </ul>
        </section>
      </div>

      <!-- ATALHOS -->
      <nav class="office-status__shortcuts" aria-label="Atalhos do escritório">
        <router-link to="/app/office/sala-ceo" class="office-status__shortcut">
          Sala da Opera
        </router-link>
        <router-link to="/app/office/missions" class="office-status__shortcut">
          Missões
        </router-link>
        <router-link to="/app/office/projetos" class="office-status__shortcut">
          Projetos
        </router-link>
        <router-link to="/app/campus" class="office-status__shortcut">
          Campus
        </router-link>
        <router-link to="/app/office/vps" class="office-status__shortcut">
          Infra
        </router-link>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.office-status {
  min-height: 100%;
}

.office-status__top .topbar__left {
  min-width: 0;
  margin-right: 16px;
}

.office-status__stage {
  padding-bottom: 40px;
  max-width: 960px;
}

.office-status__hero {
  padding: 28px 24px;
  margin-bottom: 16px;
  border-radius: 16px;
  border: 1px solid var(--border-strong);
}

.office-status__hero--ok {
  background: linear-gradient(135deg, var(--success-soft), var(--surface) 55%);
}

.office-status__hero--warn {
  background: linear-gradient(135deg, var(--warning-soft), var(--surface) 55%);
}

.office-status__hero--bad {
  background: linear-gradient(135deg, var(--danger-soft), var(--surface) 55%);
}

.office-status__greet {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--brand);
}

.office-status__lead-line {
  margin: 12px 0 0;
  color: var(--text-muted);
  font-size: var(--text-md);
}

.office-status__level {
  display: flex;
  align-items: center;
  margin-top: 8px;
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.office-status__level .chip {
  margin-right: 10px;
  font-size: 10px;
}

.office-status__summary {
  margin: 10px 0 0;
  color: var(--text);
  font-size: var(--text-lg);
  max-width: 40rem;
  line-height: 1.45;
}

.office-status__meta {
  margin: 14px 0 0;
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.office-status__quiet {
  margin: 0 0 16px;
  padding: 0 2px;
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.office-status__human {
  margin-bottom: 16px;
  padding: 20px 22px;
}

.office-status__human--need {
  border-color: var(--warning);
  background: var(--warning-soft);
}

.office-status__main {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.office-status__block {
  flex: 1 1 280px;
  margin-right: 16px;
  margin-bottom: 16px;
  padding: 20px 22px;
  min-width: 0;
}

.office-status__main .office-status__block:last-child {
  margin-right: 0;
}

.office-status__lead {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: var(--text-md);
}

.office-status__human-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}

.office-status__human-list li {
  margin-bottom: 8px;
  color: var(--text);
  font-size: var(--text-md);
}

.office-status__list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}

.office-status__list li {
  padding: 10px 0;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: var(--text-md);
  word-break: break-word;
}

.office-status__list li:first-child {
  border-top: none;
  padding-top: 0;
}

.office-status__link {
  color: var(--text);
  text-decoration: none;
}

.office-status__link:hover,
.office-status__link:focus-visible {
  color: var(--brand);
}

.office-status__attention {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}

.office-status__attention li {
  display: flex;
  flex-direction: column;
  padding: 12px 0;
  border-top: 1px solid var(--border);
}

.office-status__attention li:first-child {
  border-top: none;
  padding-top: 0;
}

.sev-label {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-soft);
  margin-bottom: 4px;
}

.sev--blocker .sev-label,
.sev--critical .sev-label {
  color: var(--danger);
}

.sev--warning .sev-label {
  color: var(--warning);
}

.sev--info .sev-label {
  color: var(--info);
}

.office-status__note {
  margin: 12px 0 0;
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.office-status__detail-btn {
  margin-top: 12px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--brand);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}

.office-status__detail-btn:hover,
.office-status__detail-btn:focus-visible {
  color: var(--info);
}

.office-status__shortcuts {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8px;
  padding-top: 8px;
}

.office-status__shortcut {
  margin-right: 8px;
  margin-bottom: 8px;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: 500;
}

.office-status__shortcut:hover,
.office-status__shortcut:focus-visible {
  color: var(--text);
  border-color: var(--brand-line);
  background: var(--surface-2);
}

.office-status__degrade {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  background: var(--warning-soft);
  color: var(--text);
  font-size: var(--text-sm);
}

.office-status__error {
  padding: 24px;
}

.office-status__error-title {
  margin: 0 0 8px;
  font-weight: 600;
  font-size: var(--text-lg);
}

.office-status__error .btn {
  margin-top: 16px;
}

.office-status__skeleton .skel {
  display: block;
  border-radius: var(--radius-xs);
  background: linear-gradient(
    90deg,
    var(--surface-2),
    var(--surface-hover),
    var(--surface-2)
  );
  background-size: 200% 100%;
  animation: office-skel 1.2s ease-in-out infinite;
}

.skel--lg {
  height: 36px;
  width: 55%;
  margin-bottom: 12px;
}

.skel--md {
  height: 18px;
  width: 75%;
}

.muted {
  color: var(--text-soft);
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

@keyframes office-skel {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@media (max-width: 768px) {
  .office-status__level {
    font-size: var(--text-xl);
  }

  .office-status__block {
    margin-right: 0;
    flex: 1 1 100%;
  }
}
</style>
