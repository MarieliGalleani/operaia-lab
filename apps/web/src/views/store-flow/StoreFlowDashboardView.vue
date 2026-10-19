<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { computeDashboard } from "@/modules/store-flow/dashboard-stats";
import { loadSavedRun, parseRun, saveRun, type ReviewRun } from "@/modules/store-flow/review-queue";

const run = ref<ReviewRun | null>(loadSavedRun());
const loadError = ref<string | null>(null);
const stats = computed(() => (run.value ? computeDashboard(run.value) : null));

/** Tabela visível por gráfico (alternativa acessível ao desenho). */
const tableOpen = reactive<Record<string, boolean>>({});

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    run.value = parseRun(await file.text());
    saveRun(run.value);
    loadError.value = null;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "Não deu para ler o arquivo.";
  }
}

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function widthOf(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "0%";
  return `${Math.max((value / max) * 100, 2)}%`;
}

const funnelMax = computed(() => Math.max(...(stats.value?.funnel.map((f) => f.value) ?? [0]), 1));
const reasonMax = computed(() => Math.max(...(stats.value?.reasons.map((r) => r.count) ?? [0]), 1));
const channelMax = computed(() => Math.max(...(stats.value?.channels.map((c) => c.total) ?? [0]), 1));

// —— Tooltip compartilhado (hover e foco de teclado) ——————————————————————
interface Tip {
  readonly x: number;
  readonly y: number;
  readonly title: string;
  readonly lines: readonly string[];
}
const tip = ref<Tip | null>(null);

function showTip(event: MouseEvent | FocusEvent, title: string, lines: readonly string[]): void {
  const target = event.currentTarget as HTMLElement;
  if (event instanceof MouseEvent && event.type === "mousemove") {
    tip.value = { x: event.clientX, y: event.clientY, title, lines };
    return;
  }
  const rect = target.getBoundingClientRect();
  tip.value = { x: rect.left + rect.width / 2, y: rect.top, title, lines };
}

function hideTip(): void {
  tip.value = null;
}

const tipStyle = computed(() => {
  if (!tip.value) return {};
  const left = Math.min(Math.max(tip.value.x, 120), window.innerWidth - 120);
  return { left: `${left}px`, top: `${tip.value.y - 14}px` };
});
</script>

<template>
  <div class="studio fsd">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">4º andar · Store Flow</p>
        <h1 class="page__title">Painel do andar</h1>
      </div>
      <div class="sfd__actions">
        <label class="btn btn--ghost sfd__upload">
          {{ run ? "Carregar outra rodada" : "Carregar rodada (.json)" }}
          <input type="file" accept="application/json,.json" class="sr-only" @change="onFile" />
        </label>
        <router-link to="/app/floor/store-flow/work" class="btn btn--primary">
          Sala de Aprovação
          <span v-if="stats && stats.drafts.PENDING_APPROVAL > 0" class="sfd__pill">
            {{ stats.drafts.PENDING_APPROVAL }}
          </span>
        </router-link>
      </div>
    </header>

    <div class="studio__stage">
      <p v-if="loadError" class="panel sfd__alert sfd__alert--danger" role="alert">{{ loadError }}</p>

      <!-- Equipe do andar -->
      <section class="sfd__crew" aria-label="Equipe do andar">
        <article class="panel sfd__agent sfd__agent--flow">
          <div class="sfd__avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </div>
          <div>
            <p class="eyebrow">Robô de Ofertas · Radar</p>
            <h2 class="sfd__agent-name">Flow</h2>
            <p class="sfd__agent-line">
              <template v-if="stats">
                Escolheu <strong>{{ stats.chosen }}</strong> de {{ stats.analyzed }} produtos · nota média
                <strong>{{ stats.averageScore }}</strong>
              </template>
              <template v-else>Esperando a primeira rodada de produtos.</template>
            </p>
          </div>
        </article>
        <article class="panel sfd__agent sfd__agent--driele">
          <div class="sfd__avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" />
            </svg>
          </div>
          <div>
            <p class="eyebrow">Escritora · Redação</p>
            <h2 class="sfd__agent-name">Driele</h2>
            <p class="sfd__agent-line">
              <template v-if="stats">
                Escreveu <strong>{{ stats.totalDrafts }}</strong> posts ·
                <strong>{{ pct(stats.aiShare) }}</strong> com IA, o resto pelo modelo seguro
              </template>
              <template v-else>Escreve assim que a Flow escolher os produtos.</template>
            </p>
          </div>
        </article>
      </section>

      <section v-if="!stats" class="panel sfd__empty">
        <h2 class="section__title">Nenhuma rodada ainda</h2>
        <p class="sfd__muted">
          Rode <code>pnpm --filter @operaia/store-flow run:csv -- produtos.csv --nicho "..." --canais instagram</code>
          na VM e carregue o <code>.json</code> aqui. O painel e a Sala de Aprovação usam a mesma rodada.
        </p>
      </section>

      <template v-else>
        <p v-if="stats.pendingLinks > 0" class="panel sfd__alert sfd__alert--warn">
          <span aria-hidden="true">⚠</span>
          {{ stats.pendingLinks }} produto(s) sem link rastreado: a venda só conta como sua depois que
          você colar o link de afiliado na Sala de Aprovação.
        </p>

        <!-- KPIs -->
        <section class="sfd__kpis" aria-label="Resumo da rodada">
          <div class="panel sfd__kpi">
            <p class="sfd__kpi-label">Potencial da rodada</p>
            <p class="sfd__kpi-value">{{ brl(stats.potentialCommission) }}</p>
            <p class="sfd__kpi-hint">1 venda de cada produto escolhido</p>
          </div>
          <div class="panel sfd__kpi">
            <p class="sfd__kpi-label">Já liberado</p>
            <p class="sfd__kpi-value">{{ brl(stats.approvedCommission) }}</p>
            <p class="sfd__kpi-hint">produtos com post aprovado</p>
          </div>
          <div class="panel sfd__kpi">
            <p class="sfd__kpi-label">Posts aguardando você</p>
            <p class="sfd__kpi-value">{{ stats.drafts.PENDING_APPROVAL }}</p>
            <p class="sfd__kpi-hint">
              {{ stats.drafts.APPROVED }} aprovados · {{ stats.drafts.REJECTED }} recusados
            </p>
          </div>
          <div class="panel sfd__kpi">
            <p class="sfd__kpi-label">Taxa de aproveitamento</p>
            <p class="sfd__kpi-value">{{ stats.analyzed ? pct(stats.chosen / stats.analyzed) : "—" }}</p>
            <p class="sfd__kpi-hint">produtos que passaram na curadoria</p>
          </div>
        </section>

        <div class="sfd__grid">
          <!-- Ranking -->
          <section class="panel sfd__chart sfd__chart--wide" aria-labelledby="sfd-rank">
            <header class="sfd__chart-head">
              <div>
                <h2 id="sfd-rank" class="sfd__chart-title">Melhores oportunidades</h2>
                <p class="sfd__muted">Nota da Flow (0–100): comissão, avaliação, vendas e loja</p>
              </div>
              <button type="button" class="btn btn--ghost sfd__toggle" :aria-pressed="!!tableOpen.rank" @click="tableOpen.rank = !tableOpen.rank">
                {{ tableOpen.rank ? "Ver gráfico" : "Ver tabela" }}
              </button>
            </header>
            <table v-if="tableOpen.rank" class="sfd__table">
              <thead><tr><th>Produto</th><th>Nota</th><th>Comissão/venda</th><th>Preço</th></tr></thead>
              <tbody>
                <tr v-for="p in stats.ranking" :key="p.id">
                  <td>{{ p.title }}</td><td>{{ p.score }}</td><td>{{ brl(p.estimatedCommission) }}</td><td>{{ brl(p.price) }}</td>
                </tr>
              </tbody>
            </table>
            <ol v-else class="sfd__bars" role="list">
              <li
                v-for="(p, i) in stats.ranking"
                :key="p.id"
                class="sfd__row"
                tabindex="0"
                @mousemove="showTip($event, p.title, [`Nota ${p.score}/100`, `≈ ${brl(p.estimatedCommission)} por venda`, `Preço ${brl(p.price)} · ${p.category}`, ...(p.signals.length ? [p.signals.join(' · ')] : []), ...(p.linkPending ? ['Link ainda sem rastreio'] : [])])"
                @mouseleave="hideTip"
                @focus="showTip($event, p.title, [`Nota ${p.score}/100`, `≈ ${brl(p.estimatedCommission)} por venda`])"
                @blur="hideTip"
              >
                <span class="sfd__row-label">
                  <span class="sfd__rank">{{ i + 1 }}</span>{{ p.title }}
                  <span v-for="sig in p.signals" :key="sig" class="sfd__signal">{{ sig }}</span>
                </span>
                <span class="sfd__track">
                  <span class="sfd__bar" :style="{ width: widthOf(p.score, 100) }" />
                </span>
                <span class="sfd__row-value">{{ p.score }}<small> · {{ brl(p.estimatedCommission) }}</small></span>
              </li>
            </ol>
          </section>

          <!-- Funil -->
          <section class="panel sfd__chart" aria-labelledby="sfd-funnel">
            <header class="sfd__chart-head">
              <div>
                <h2 id="sfd-funnel" class="sfd__chart-title">Caminho da rodada</h2>
                <p class="sfd__muted">Do produto analisado ao post liberado</p>
              </div>
              <button type="button" class="btn btn--ghost sfd__toggle" :aria-pressed="!!tableOpen.funnel" @click="tableOpen.funnel = !tableOpen.funnel">
                {{ tableOpen.funnel ? "Ver gráfico" : "Ver tabela" }}
              </button>
            </header>
            <table v-if="tableOpen.funnel" class="sfd__table">
              <thead><tr><th>Etapa</th><th>Quantidade</th></tr></thead>
              <tbody><tr v-for="f in stats.funnel" :key="f.id"><td>{{ f.label }}</td><td>{{ f.value }}</td></tr></tbody>
            </table>
            <ol v-else class="sfd__bars" role="list">
              <li
                v-for="f in stats.funnel"
                :key="f.id"
                class="sfd__row sfd__row--stack"
                tabindex="0"
                @mousemove="showTip($event, f.label, [`${f.value} ${f.hint}`])"
                @mouseleave="hideTip"
                @focus="showTip($event, f.label, [`${f.value} ${f.hint}`])"
                @blur="hideTip"
              >
                <span class="sfd__row-label">{{ f.label }}</span>
                <span class="sfd__row-value">{{ f.value }}</span>
                <span class="sfd__track sfd__track--full">
                  <span class="sfd__bar" :style="{ width: widthOf(f.value, funnelMax) }" />
                </span>
              </li>
            </ol>
          </section>

          <!-- Posts por canal (status) -->
          <section class="panel sfd__chart" aria-labelledby="sfd-channels">
            <header class="sfd__chart-head">
              <div>
                <h2 id="sfd-channels" class="sfd__chart-title">Posts por canal</h2>
                <p class="sfd__muted">Situação da aprovação</p>
              </div>
              <button type="button" class="btn btn--ghost sfd__toggle" :aria-pressed="!!tableOpen.channels" @click="tableOpen.channels = !tableOpen.channels">
                {{ tableOpen.channels ? "Ver gráfico" : "Ver tabela" }}
              </button>
            </header>
            <ul class="sfd__legend" aria-label="Legenda">
              <li><span class="sfd__swatch sfd__swatch--good" aria-hidden="true">✓</span>Aprovado</li>
              <li><span class="sfd__swatch sfd__swatch--warn" aria-hidden="true">•</span>Pendente</li>
              <li><span class="sfd__swatch sfd__swatch--bad" aria-hidden="true">✕</span>Recusado</li>
            </ul>
            <table v-if="tableOpen.channels" class="sfd__table">
              <thead><tr><th>Canal</th><th>Aprovados</th><th>Pendentes</th><th>Recusados</th></tr></thead>
              <tbody>
                <tr v-for="c in stats.channels" :key="c.channel">
                  <td>{{ c.label }}</td><td>{{ c.approved }}</td><td>{{ c.pending }}</td><td>{{ c.rejected }}</td>
                </tr>
              </tbody>
            </table>
            <ol v-else class="sfd__bars" role="list">
              <li
                v-for="c in stats.channels"
                :key="c.channel"
                class="sfd__row sfd__row--stack"
                tabindex="0"
                @mousemove="showTip($event, c.label, [`${c.approved} aprovado(s)`, `${c.pending} pendente(s)`, `${c.rejected} recusado(s)`])"
                @mouseleave="hideTip"
                @focus="showTip($event, c.label, [`${c.approved} aprovado(s)`, `${c.pending} pendente(s)`, `${c.rejected} recusado(s)`])"
                @blur="hideTip"
              >
                <span class="sfd__row-label">{{ c.label }}</span>
                <span class="sfd__row-value">{{ c.approved }}/{{ c.total }} aprovados</span>
                <span class="sfd__track sfd__track--full sfd__stack" :style="{ width: widthOf(c.total, channelMax) }">
                  <span v-if="c.approved" class="sfd__seg sfd__seg--good" :style="{ flexGrow: c.approved }" />
                  <span v-if="c.pending" class="sfd__seg sfd__seg--warn" :style="{ flexGrow: c.pending }" />
                  <span v-if="c.rejected" class="sfd__seg sfd__seg--bad" :style="{ flexGrow: c.rejected }" />
                </span>
              </li>
            </ol>
          </section>

          <!-- Motivos de recusa -->
          <section class="panel sfd__chart sfd__chart--wide" aria-labelledby="sfd-reasons">
            <header class="sfd__chart-head">
              <div>
                <h2 id="sfd-reasons" class="sfd__chart-title">Por que a Flow deixou de fora</h2>
                <p class="sfd__muted">Ajuda a escolher melhor o CSV da próxima rodada</p>
              </div>
              <button
                v-if="stats.reasons.length"
                type="button"
                class="btn btn--ghost sfd__toggle"
                :aria-pressed="!!tableOpen.reasons"
                @click="tableOpen.reasons = !tableOpen.reasons"
              >
                {{ tableOpen.reasons ? "Ver gráfico" : "Ver tabela" }}
              </button>
            </header>
            <p v-if="!stats.reasons.length" class="sfd__muted">Nenhum produto recusado nesta rodada.</p>
            <table v-else-if="tableOpen.reasons" class="sfd__table">
              <thead><tr><th>Motivo</th><th>Produtos</th><th>Exemplos</th></tr></thead>
              <tbody>
                <tr v-for="r in stats.reasons" :key="r.id">
                  <td>{{ r.label }}</td><td>{{ r.count }}</td><td>{{ r.examples.join(", ") }}</td>
                </tr>
              </tbody>
            </table>
            <ol v-else class="sfd__bars" role="list">
              <li
                v-for="r in stats.reasons"
                :key="r.id"
                class="sfd__row"
                tabindex="0"
                @mousemove="showTip($event, r.label, [`${r.count} produto(s)`, ...r.examples])"
                @mouseleave="hideTip"
                @focus="showTip($event, r.label, [`${r.count} produto(s)`])"
                @blur="hideTip"
              >
                <span class="sfd__row-label">{{ r.label }}</span>
                <span class="sfd__track">
                  <span class="sfd__bar sfd__bar--muted" :style="{ width: widthOf(r.count, reasonMax) }" />
                </span>
                <span class="sfd__row-value">{{ r.count }}</span>
              </li>
            </ol>
          </section>
        </div>
      </template>
    </div>

    <div v-if="tip" class="sfd__tip" :style="tipStyle" role="tooltip">
      <strong>{{ tip.title }}</strong>
      <span v-for="line in tip.lines" :key="line">{{ line }}</span>
    </div>
  </div>
</template>

<style scoped>
.fsd {
  /* Papéis de cor do painel (app é escuro). Azul = magnitude (um tom só). */
  --sfd-seq: #3987e5;
  --sfd-seq-muted: #6da7ec;
  --sfd-track: rgba(148, 163, 184, 0.1);
  /* Status reservados: sempre com ícone + rótulo. */
  --sfd-good: #0ca30c;
  --sfd-warn: #fab219;
  --sfd-bad: #d03b3b;
  --sfd-flow: #2f7a80;
  --sfd-driele: #d06a52;
}

.sfd__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sfd__upload {
  cursor: pointer;
}

.sfd__pill {
  margin-left: 6px;
  min-width: 20px;
  padding: 0 6px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.2);
  font-size: 0.8em;
  text-align: center;
}

.sfd__muted {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.sfd__muted code {
  font-size: 0.85em;
  word-break: break-word;
}

.sfd__alert,
.sfd__empty {
  padding: 14px 18px;
  margin-bottom: 14px;
}

.sfd__alert--warn {
  border-color: var(--warning);
  background: var(--warning-soft);
}

.sfd__alert--danger {
  border-color: var(--danger);
  background: var(--danger-soft);
}

/* —— Equipe —— */
.sfd__crew {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.sfd__agent {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 16px 18px;
  border-left: 3px solid var(--agent);
}

.sfd__agent--flow {
  --agent: var(--sfd-flow);
}

.sfd__agent--driele {
  --agent: var(--sfd-driele);
}

.sfd__avatar {
  flex: none;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: color-mix(in srgb, var(--agent) 22%, transparent);
  color: var(--text);
}

.sfd__avatar svg {
  width: 24px;
  height: 24px;
}

.sfd__agent-name {
  margin: 0;
  font-size: 1.15rem;
}

.sfd__agent-line {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.sfd__agent-line strong {
  color: var(--text);
}

/* —— KPIs —— */
.sfd__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.sfd__kpi {
  padding: 16px 18px;
}

.sfd__kpi-label,
.sfd__kpi-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.sfd__kpi-value {
  margin: 6px 0 4px;
  font-size: 1.7rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

/* —— Gráficos —— */
.sfd__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.sfd__chart {
  padding: 18px;
  min-width: 0;
}

.sfd__chart--wide {
  grid-column: 1 / -1;
}

.sfd__chart-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 14px;
}

.sfd__chart-title {
  margin: 0;
  font-size: 1rem;
}

.sfd__toggle {
  flex: none;
  font-size: 0.82rem;
}

.sfd__bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}

.sfd__row {
  display: grid;
  grid-template-columns: minmax(120px, 32%) 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 7px 8px;
  border-radius: var(--radius-xs);
  outline: none;
}

.sfd__row--stack {
  grid-template-columns: 1fr auto;
  row-gap: 6px;
}

.sfd__row:hover,
.sfd__row:focus-visible {
  background: var(--surface-hover);
}

.sfd__row:focus-visible {
  box-shadow: 0 0 0 2px var(--brand-line);
}

.sfd__row-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 0.9rem;
}

.sfd__rank {
  display: inline-block;
  width: 1.4em;
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}

.sfd__signal {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--brand-soft);
  color: var(--text-muted);
  font-size: 0.72rem;
  vertical-align: 1px;
}

.sfd__row-value {
  color: var(--text);
  font-size: 0.88rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.sfd__row-value small {
  color: var(--text-muted);
  font-size: 0.85em;
}

.sfd__track {
  position: relative;
  display: block;
  height: 12px;
  border-radius: 0 4px 4px 0;
  background: var(--sfd-track);
}

.sfd__track--full {
  grid-column: 1 / -1;
}

.sfd__bar {
  display: block;
  height: 100%;
  border-radius: 0 4px 4px 0;
  background: var(--sfd-seq);
  transition: width 0.4s ease;
}

.sfd__bar--muted {
  background: var(--sfd-seq-muted);
}

.sfd__stack {
  display: flex;
  gap: 2px;
  background: transparent;
}

.sfd__seg {
  flex-basis: 0;
  height: 100%;
}

.sfd__seg:last-child {
  border-radius: 0 4px 4px 0;
}

.sfd__seg--good {
  background: var(--sfd-good);
}

.sfd__seg--warn {
  background: var(--sfd-warn);
}

.sfd__seg--bad {
  background: var(--sfd-bad);
}

.sfd__legend {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin: -4px 0 10px;
  padding: 0;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.sfd__legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sfd__swatch {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  display: grid;
  place-items: center;
  color: #0b0b0b;
  font-size: 11px;
  font-weight: 700;
}

.sfd__swatch--good {
  background: var(--sfd-good);
}

.sfd__swatch--warn {
  background: var(--sfd-warn);
}

.sfd__swatch--bad {
  background: var(--sfd-bad);
  color: #fff;
}

.sfd__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.sfd__table th,
.sfd__table td {
  padding: 8px 6px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.sfd__table th {
  color: var(--text-muted);
  font-weight: 500;
}

.sfd__table td:not(:first-child),
.sfd__table th:not(:first-child) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.sfd__tip {
  position: fixed;
  z-index: 50;
  transform: translate(-50%, -100%);
  display: grid;
  gap: 2px;
  max-width: 240px;
  padding: 8px 10px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-strong);
  background: var(--surface-2);
  box-shadow: var(--shadow);
  color: var(--text-muted);
  font-size: 0.8rem;
  pointer-events: none;
}

.sfd__tip strong {
  color: var(--text);
  font-weight: 600;
}

@media (max-width: 760px) {
  .sfd__grid {
    grid-template-columns: 1fr;
  }

  .sfd__row {
    grid-template-columns: minmax(90px, 38%) 1fr auto;
    gap: 8px;
  }
}
</style>
