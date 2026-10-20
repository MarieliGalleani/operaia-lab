<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  CATEGORY_LABEL,
  RECEIVABLES_ROUTE,
  SEVERITY_LABEL,
  brl,
  dateBr,
  downloadTemplate,
  fetchDashboard,
  pct,
  uploadSalesFile,
  type BusinessDashboard,
  type BusinessInsight,
} from "@/modules/business/business-api";

const data = ref<BusinessDashboard | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const uploading = ref(false);
const notice = ref<string | null>(null);
const tableOpen = reactive<Record<string, boolean>>({});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    data.value = await fetchDashboard();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Não deu para carregar o painel agora.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  uploading.value = true;
  error.value = null;
  notice.value = null;
  try {
    const r = await uploadSalesFile(file);
    const parts = [`${r.rowsAccepted} venda(s) nova(s) de "${r.fileName}"`];
    if (r.rowsDuplicated) parts.push(`${r.rowsDuplicated} já estavam no andar`);
    if (r.rowsRejected) parts.push(`${r.rowsRejected} linha(s) recusada(s) — veja em Planilhas`);
    notice.value = `Aurora leu a planilha: ${parts.join(" · ")}.`;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Não deu para enviar a planilha.";
  } finally {
    uploading.value = false;
  }
}

const k = computed(() => data.value?.kpis);

const sourceText = computed(() => {
  const src = data.value?.sources;
  if (!src) return "";
  const parts: string[] = [];
  if (src.crmPayments) parts.push(`${src.crmPayments} recebimento(s) da Carteira de Clientes`);
  if (src.spreadsheetSales) parts.push(`${src.spreadsheetSales} venda(s) de planilha`);
  return parts.length ? `Fonte: ${parts.join(" + ")}.` : "";
});
const others = computed<BusinessInsight[]>(() => {
  const d = data.value;
  if (!d) return [];
  return d.insights.filter((i) => i.key !== d.priority?.key);
});

const monthMax = computed(() => Math.max(...(data.value?.months.map((m) => m.revenue) ?? [0]), 1));
const customerMax = computed(() => Math.max(...(data.value?.topCustomers.map((c) => c.revenue) ?? [0]), 1));
const productMax = computed(() => Math.max(...(data.value?.topProducts.map((p) => p.revenue) ?? [0]), 1));

function widthOf(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "0%";
  return `${Math.max((value / max) * 100, 2)}%`;
}

function trendText(t: number | null, basis: "AVG_90" | "PREV_30" | null): string {
  if (t === null || basis === null) return "precisa de 60 dias de vendas para comparar";
  const ref = basis === "AVG_90" ? "média dos 3 meses antes" : "30 dias antes";
  if (Math.abs(t) < 0.5) return `últimos 30 dias estáveis vs ${ref}`;
  return `${t > 0 ? "▲" : "▼"} ${pct(Math.abs(t), 0)} nos últimos 30 dias vs ${ref}`;
}

const ICON: Record<BusinessInsight["category"], string> = { RISK: "!", PROBLEM: "✕", OPPORTUNITY: "↗" };
</script>

<template>
  <div class="studio biz">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">5º andar · Negócio</p>
        <h1 class="page__title">Painel do negócio</h1>
      </div>
      <div class="biz__actions">
        <span v-if="data?.period" class="biz__period">
          Vendas de {{ dateBr(data.period.from) }} a {{ dateBr(data.period.to) }}
        </span>
        <router-link to="/app/floor/negocio/work" class="btn btn--ghost">Planilhas</router-link>
        <router-link :to="RECEIVABLES_ROUTE" class="btn btn--primary">Lançar recebimento</router-link>
      </div>
    </header>

    <div class="studio__stage">
      <p v-if="error" class="panel biz__alert biz__alert--danger" role="alert">{{ error }}</p>
      <p v-if="notice" class="panel biz__alert biz__alert--ok" role="status">{{ notice }}</p>

      <p v-if="loading && !data" class="biz__muted">Carregando o painel…</p>

      <!-- Vazio: como começar -->
      <section v-else-if="data && data.empty" class="panel biz__empty">
        <div class="biz__agent">
          <img src="/assets/office/agents/aurora.png" alt="" class="biz__agent-img" />
          <div>
            <p class="eyebrow">Finanças · Andar 05</p>
            <h2 class="biz__agent-name">Aurora ainda não tem recebimentos para analisar</h2>
            <p class="biz__muted">
              Cada pagamento que um cliente faz para a OperaIA é uma venda. Lance os recebimentos e a Aurora mostra
              receita, tendência, quem parou de pagar e o que fazer primeiro — sem planilha.
            </p>
          </div>
        </div>
        <ol class="biz__steps">
          <li>Vá em <strong>Marketing › Trabalhos › Carteira de Clientes</strong> e abra o cliente.</li>
          <li>Em pagamentos, lance cada <strong>setup</strong> e cada <strong>mensalidade</strong> recebida, com valor e data.</li>
          <li>Pronto: este painel se atualiza sozinho. Tem histórico antigo numa planilha? Dá para enviar também.</li>
        </ol>
        <div class="biz__actions">
          <router-link :to="RECEIVABLES_ROUTE" class="btn btn--primary">Lançar recebimento</router-link>
          <label class="btn btn--ghost biz__upload" :class="{ 'is-busy': uploading }">
            {{ uploading ? "Aurora lendo…" : "Enviar planilha de histórico" }}
            <input type="file" accept=".csv,text/csv,.txt" class="sr-only" :disabled="uploading" @change="onFile" />
          </label>
          <button type="button" class="btn btn--ghost" @click="downloadTemplate">Modelo da planilha</button>
        </div>
      </section>

      <template v-else-if="data && k">
        <!-- Aurora + saúde -->
        <section class="biz__top">
          <article class="panel biz__agent biz__agent--card">
            <img src="/assets/office/agents/aurora.png" alt="" class="biz__agent-img" />
            <div>
              <p class="eyebrow">Aurora · Finanças</p>
              <p class="biz__summary">{{ data.summary }}</p>
              <p class="biz__source">{{ sourceText }}</p>
            </div>
          </article>
          <article class="panel biz__health" :class="`is-${data.health.level.toLowerCase()}`">
            <p class="biz__kpi-label">Saúde do negócio</p>
            <p class="biz__health-score">{{ data.health.score }}<small>/100</small></p>
            <p class="biz__health-label">{{ data.health.label }}</p>
            <span class="biz__health-track" aria-hidden="true">
              <span class="biz__health-bar" :style="{ width: `${data.health.score}%` }" />
            </span>
          </article>
        </section>

        <!-- Prioridade -->
        <section v-if="data.priority" class="panel biz__priority" :class="`is-${data.priority.category.toLowerCase()}`" aria-labelledby="biz-prio">
          <p class="eyebrow">
            <span class="biz__icon" aria-hidden="true">{{ ICON[data.priority.category] }}</span>
            Faça isto primeiro · {{ CATEGORY_LABEL[data.priority.category] }} · prioridade {{ SEVERITY_LABEL[data.priority.severity].toLowerCase() }}
          </p>
          <h2 id="biz-prio" class="biz__priority-title">{{ data.priority.title }}</h2>
          <div class="biz__priority-grid">
            <div>
              <p class="biz__kpi-label">O que está acontecendo</p>
              <p>{{ data.priority.detail }}</p>
            </div>
            <div>
              <p class="biz__kpi-label">O que fazer</p>
              <p>{{ data.priority.action }}</p>
            </div>
            <div v-if="data.priority.impactLabel">
              <p class="biz__kpi-label">Em jogo</p>
              <p class="biz__impact">{{ data.priority.impactLabel }}</p>
            </div>
          </div>
        </section>

        <!-- KPIs -->
        <section class="biz__kpis" aria-label="Números do período">
          <div class="panel biz__kpi">
            <p class="biz__kpi-label">Receita</p>
            <p class="biz__kpi-value">{{ brl(k.revenue) }}</p>
            <p class="biz__kpi-hint" :class="{ 'is-up': (k.revenueTrendPct ?? 0) > 0.5, 'is-down': (k.revenueTrendPct ?? 0) < -0.5 }">
              {{ trendText(k.revenueTrendPct, k.trendBasis) }}
            </p>
          </div>
          <div class="panel biz__kpi">
            <p class="biz__kpi-label">Lucro bruto</p>
            <p class="biz__kpi-value">{{ k.profit === null ? "—" : brl(k.profit) }}</p>
            <p class="biz__kpi-hint">{{ k.profit === null ? "sem custos lançados" : "receita menos custo" }}</p>
          </div>
          <div class="panel biz__kpi">
            <p class="biz__kpi-label">Margem</p>
            <p class="biz__kpi-value">{{ pct(k.marginPct) }}</p>
            <p class="biz__kpi-hint">{{ k.marginPct === null ? "sem custos lançados" : "do que entra, quanto sobra" }}</p>
          </div>
          <div class="panel biz__kpi">
            <p class="biz__kpi-label">Ticket médio</p>
            <p class="biz__kpi-value">{{ brl(k.avgTicket) }}</p>
            <p class="biz__kpi-hint">{{ k.salesCount }} vendas · {{ k.customersCount }} clientes</p>
          </div>
        </section>

        <div class="biz__grid">
          <!-- Receita por mês -->
          <section class="panel biz__chart biz__chart--wide" aria-labelledby="biz-months">
            <header class="biz__chart-head">
              <div>
                <h2 id="biz-months" class="biz__chart-title">Receita por mês</h2>
                <p class="biz__muted">{{ data.hasCost ? "Barra cheia = receita · parte escura = lucro" : "Receita de cada mês" }}</p>
              </div>
              <button type="button" class="btn btn--ghost biz__toggle" :aria-pressed="!!tableOpen.months" @click="tableOpen.months = !tableOpen.months">
                {{ tableOpen.months ? "Ver gráfico" : "Ver tabela" }}
              </button>
            </header>
            <table v-if="tableOpen.months" class="biz__table">
              <thead><tr><th>Mês</th><th>Receita</th><th>Lucro</th><th>Vendas</th></tr></thead>
              <tbody>
                <tr v-for="m in data.months" :key="m.month">
                  <td>{{ m.label }}</td><td>{{ brl(m.revenue) }}</td><td>{{ m.profit === null ? "—" : brl(m.profit) }}</td><td>{{ m.sales }}</td>
                </tr>
              </tbody>
            </table>
            <ol v-else class="biz__cols" role="list">
              <li v-for="m in data.months" :key="m.month" class="biz__col" :title="`${m.label}: ${brl(m.revenue)}${m.profit !== null ? ` · lucro ${brl(m.profit)}` : ''}`">
                <span class="biz__col-value">{{ brl(m.revenue) }}</span>
                <span class="biz__col-track">
                  <span class="biz__col-bar" :style="{ height: widthOf(m.revenue, monthMax) }">
                    <span
                      v-if="m.profit !== null && m.profit > 0"
                      class="biz__col-profit"
                      :style="{ height: widthOf(m.profit, m.revenue) }"
                    />
                  </span>
                </span>
                <span class="biz__col-label">{{ m.label }}</span>
              </li>
            </ol>
          </section>

          <!-- Clientes -->
          <section class="panel biz__chart" aria-labelledby="biz-customers">
            <header class="biz__chart-head">
              <div>
                <h2 id="biz-customers" class="biz__chart-title">Maiores clientes</h2>
                <p class="biz__muted">Receita no período e dias sem comprar</p>
              </div>
            </header>
            <ol class="biz__bars" role="list">
              <li v-for="c in data.topCustomers" :key="c.name" class="biz__row">
                <span class="biz__row-label">{{ c.name }}</span>
                <span class="biz__row-value">{{ brl(c.revenue) }} <small>· {{ pct(c.sharePct, 0) }}</small></span>
                <span class="biz__track"><span class="biz__bar" :style="{ width: widthOf(c.revenue, customerMax) }" /></span>
                <span class="biz__row-meta" :class="{ 'is-warn': c.daysSinceLastPurchase > 45 }">
                  {{ c.daysSinceLastPurchase === 0 ? "comprou no último dia" : `${c.daysSinceLastPurchase} dias sem comprar` }}
                </span>
              </li>
            </ol>
          </section>

          <!-- Produtos -->
          <section class="panel biz__chart" aria-labelledby="biz-products">
            <header class="biz__chart-head">
              <div>
                <h2 id="biz-products" class="biz__chart-title">Produtos que mais vendem</h2>
                <p class="biz__muted">{{ data.hasCost ? "Receita e margem de cada um" : "Receita de cada um" }}</p>
              </div>
            </header>
            <ol class="biz__bars" role="list">
              <li v-for="p in data.topProducts" :key="p.name" class="biz__row">
                <span class="biz__row-label">{{ p.name }}</span>
                <span class="biz__row-value">{{ brl(p.revenue) }}</span>
                <span class="biz__track"><span class="biz__bar" :style="{ width: widthOf(p.revenue, productMax) }" /></span>
                <span v-if="p.marginPct !== null" class="biz__row-meta" :class="{ 'is-bad': p.marginPct < 0, 'is-warn': p.marginPct >= 0 && k.marginPct !== null && p.marginPct < k.marginPct - 5 }">
                  margem {{ pct(p.marginPct) }}
                </span>
              </li>
            </ol>
          </section>

          <!-- Demais alertas -->
          <section class="panel biz__chart biz__chart--wide" aria-labelledby="biz-insights">
            <header class="biz__chart-head">
              <div>
                <h2 id="biz-insights" class="biz__chart-title">Outros pontos da Aurora</h2>
                <p class="biz__muted">Do mais urgente para o menos urgente</p>
              </div>
            </header>
            <p v-if="!others.length" class="biz__muted">Nada além da prioridade acima. 👍</p>
            <ul v-else class="biz__insights" role="list">
              <li v-for="i in others" :key="i.key" class="biz__insight" :class="`is-${i.category.toLowerCase()}`">
                <span class="biz__icon" aria-hidden="true">{{ ICON[i.category] }}</span>
                <div>
                  <p class="biz__insight-title">
                    {{ i.title }}
                    <span class="biz__chip">{{ CATEGORY_LABEL[i.category] }} · {{ SEVERITY_LABEL[i.severity] }}</span>
                  </p>
                  <p class="biz__muted">{{ i.detail }}</p>
                  <p class="biz__insight-action"><strong>O que fazer:</strong> {{ i.action }}</p>
                </div>
                <span v-if="i.impactLabel" class="biz__insight-impact">{{ i.impactLabel }}</span>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.biz {
  --biz-seq: #3987e5;
  --biz-seq-strong: #1f5fae;
  --biz-track: rgba(148, 163, 184, 0.12);
  --biz-good: #0ca30c;
  --biz-warn: #fab219;
  --biz-bad: #d03b3b;
  --biz-aurora: #c3e86b;
}

.biz__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.biz__period {
  font-size: 12px;
  color: var(--text-muted);
}

.biz__upload {
  cursor: pointer;
}

.biz__upload.is-busy {
  opacity: 0.7;
  cursor: progress;
}

.biz__muted {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.biz__alert {
  padding: 14px 18px;
  margin-bottom: 14px;
}

.biz__alert--ok {
  border-color: var(--success);
  background: var(--success-soft);
}

.biz__alert--danger {
  border-color: var(--danger);
  background: var(--danger-soft);
}

/* —— Vazio —— */
.biz__empty {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
}

.biz__steps {
  margin: 0;
  padding-left: 20px;
  display: grid;
  gap: 6px;
  color: var(--text);
  font-size: 0.92rem;
}

.biz__steps code {
  font-size: 0.85em;
  word-break: break-word;
}

/* —— Aurora + saúde —— */
.biz__top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 14px;
  margin-bottom: 14px;
}

.biz__agent {
  display: flex;
  gap: 14px;
  align-items: center;
}

.biz__agent--card {
  padding: 16px 18px;
  border-left: 3px solid var(--biz-aurora);
}

.biz__agent-img {
  flex: none;
  width: 52px;
  height: 52px;
  object-fit: contain;
  image-rendering: pixelated;
  border-radius: 12px;
  background: color-mix(in srgb, var(--biz-aurora) 18%, transparent);
}

.biz__agent-name {
  margin: 0;
  font-size: 1.15rem;
}

.biz__source {
  margin: 6px 0 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.biz__summary {
  margin: 4px 0 0;
  color: var(--text);
  line-height: 1.5;
}

.biz__health {
  padding: 16px 18px;
}

.biz__health-score {
  margin: 4px 0 0;
  font-size: 2rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.biz__health-score small {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-weight: 400;
}

.biz__health-label {
  margin: 0 0 8px;
  font-weight: 600;
}

.biz__health-track {
  display: block;
  height: 6px;
  border-radius: 999px;
  background: var(--biz-track);
  overflow: hidden;
}

.biz__health-bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--tone);
}

.biz__health.is-excellent,
.biz__health.is-good {
  --tone: var(--biz-good);
}

.biz__health.is-attention {
  --tone: var(--biz-warn);
}

.biz__health.is-critical {
  --tone: var(--biz-bad);
}

.biz__health .biz__health-label {
  color: var(--tone);
}

/* —— Prioridade —— */
.biz__priority {
  padding: 18px 20px;
  margin-bottom: 14px;
  border-left: 3px solid var(--tone);
}

.biz__priority.is-risk {
  --tone: var(--biz-warn);
}

.biz__priority.is-problem {
  --tone: var(--biz-bad);
}

.biz__priority.is-opportunity {
  --tone: var(--biz-good);
}

.biz__priority-title {
  margin: 6px 0 12px;
  font-size: 1.25rem;
}

.biz__priority-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}

.biz__priority-grid p {
  margin: 2px 0 0;
}

.biz__impact {
  font-weight: 650;
  color: var(--text);
}

.biz__icon {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-right: 4px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: var(--tone, var(--biz-seq));
  vertical-align: middle;
}

/* —— KPIs —— */
.biz__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.biz__kpi {
  padding: 16px 18px;
}

.biz__kpi-label,
.biz__kpi-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.biz__kpi-hint.is-up {
  color: var(--biz-good);
}

.biz__kpi-hint.is-down {
  color: var(--biz-bad);
}

.biz__kpi-value {
  margin: 6px 0 4px;
  font-size: 1.6rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

/* —— Gráficos —— */
.biz__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.biz__chart {
  padding: 18px;
  min-width: 0;
}

.biz__chart--wide {
  grid-column: 1 / -1;
}

.biz__chart-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 14px;
}

.biz__chart-title {
  margin: 0;
  font-size: 1rem;
}

.biz__toggle {
  flex: none;
  font-size: 0.82rem;
}

.biz__cols {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 8px;
  align-items: stretch;
  overflow-x: auto;
  min-height: 210px;
}

.biz__col {
  flex: 1 0 44px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 6px;
  text-align: center;
}

.biz__col-value {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.biz__col-track {
  display: flex;
  align-items: flex-end;
  min-height: 150px;
  border-radius: 6px;
  background: var(--biz-track);
}

.biz__col-bar {
  position: relative;
  display: flex;
  align-items: flex-end;
  width: 100%;
  border-radius: 6px;
  background: var(--biz-seq);
}

.biz__col-profit {
  display: block;
  width: 100%;
  border-radius: 0 0 6px 6px;
  background: var(--biz-seq-strong);
}

.biz__col-label {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.biz__bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.biz__row {
  display: grid;
  grid-template-columns: 1fr auto;
  row-gap: 4px;
  column-gap: 12px;
}

.biz__row-label {
  min-width: 0;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.biz__row-value {
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.biz__row-value small {
  color: var(--text-muted);
}

.biz__track {
  grid-column: 1 / -1;
  display: block;
  height: 8px;
  border-radius: 999px;
  background: var(--biz-track);
  overflow: hidden;
}

.biz__bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--biz-seq);
}

.biz__row-meta {
  grid-column: 1 / -1;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.biz__row-meta.is-warn {
  color: var(--biz-warn);
}

.biz__row-meta.is-bad {
  color: var(--biz-bad);
}

.biz__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.biz__table th,
.biz__table td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-variant-numeric: tabular-nums;
}

.biz__insights {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.biz__insight {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: start;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.biz__insight.is-risk {
  --tone: var(--biz-warn);
}

.biz__insight.is-problem {
  --tone: var(--biz-bad);
}

.biz__insight.is-opportunity {
  --tone: var(--biz-good);
}

.biz__insight p {
  margin: 0;
}

.biz__insight-title {
  font-weight: 600;
  color: var(--text);
}

.biz__insight-action {
  margin-top: 4px !important;
  font-size: 0.88rem;
}

.biz__insight-impact {
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.biz__chip {
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--biz-track);
}

@media (max-width: 900px) {
  .biz__top,
  .biz__grid {
    grid-template-columns: 1fr;
  }

  .biz__insight {
    grid-template-columns: auto 1fr;
  }

  .biz__insight-impact {
    grid-column: 2;
  }
}
</style>
