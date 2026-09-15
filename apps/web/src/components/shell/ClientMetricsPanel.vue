<script setup lang="ts">
/**
 * Acompanhamento continuo por cliente (P1.X Fase 7) — usado tanto pra
 * Trafego Pago quanto pra Performance: mesma estrutura (plano de
 * referencia definido pelo Mercurio + lancamentos reais ao longo do
 * tempo), so muda o "kind" e qual plano mostrar como referencia.
 */
import { computed, onMounted, ref, watch } from "vue";
import {
  createMarketingOfficeClient,
  type ClientMetricKind,
  type ClientSummary,
  type MetricEntry,
} from "@/data/adapters/marketing-office-client";
import {
  createGoogleAdsClient,
  type GoogleAdsAnalysis,
  type GoogleAdsConnectionStatus,
  type NegativeKeywordRecommendation,
} from "@/data/adapters/google-ads-client";

const props = defineProps<{
  kind: ClientMetricKind;
  title: string;
  hint: string;
}>();

const client = createMarketingOfficeClient();
const googleAds = createGoogleAdsClient();

const clients = ref<readonly ClientSummary[]>([]);
const selectedClientId = ref<string | null>(null);
const selectedClient = computed(
  () => clients.value.find((c) => c.id === selectedClientId.value) ?? null,
);

const entries = ref<readonly MetricEntry[]>([]);
const planoTrafego = ref<string | null>(null);
const frameworkPerformance = ref<string | null>(null);
const loadState = ref<"idle" | "loading" | "ready" | "error">("idle");

const metric = ref("");
const channel = ref("");
const period = ref(new Date().toISOString().slice(0, 10));
const value = ref("");
const note = ref("");
const submitting = ref(false);
const submitError = ref<string | null>(null);

const gadsStatus = ref<GoogleAdsConnectionStatus | null>(null);
const gadsLoadState = ref<"idle" | "loading" | "ready" | "error">("idle");
const gadsAnalysis = ref<GoogleAdsAnalysis | null>(null);
const gadsAnalysisState = ref<"idle" | "loading" | "ready" | "error">("idle");
const gadsAnalysisError = ref<string | null>(null);
const gadsCustomerId = ref("");
const gadsLoginCustomerId = ref("");
const gadsApplyingKey = ref<string | null>(null);
const gadsAppliedKeys = ref<Set<string>>(new Set());
const gadsDisconnecting = ref(false);

function gadsRecKey(rec: NegativeKeywordRecommendation): string {
  return `${rec.campaignId}:${rec.term}`;
}

interface PlanoTrafego {
  objetivoCampanha: string;
  plataformaPrincipal: string;
  publicos: readonly { nome: string; descricao: string }[];
  distribuicaoOrcamento: readonly { conjunto: string; percentual: number }[];
}

interface FrameworkPerformance {
  metricas: readonly {
    nome: string;
    canal: string;
    frequencia: string;
    referenciaDeMercado: string;
    seAbaixoDoEsperado: string;
  }[];
  notaImportante: string;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const activeTrafego = computed<PlanoTrafego | null>(() => parseJson<PlanoTrafego>(planoTrafego.value));
const activePerformance = computed<FrameworkPerformance | null>(() =>
  parseJson<FrameworkPerformance>(frameworkPerformance.value),
);

/** Agrupa lancamentos por metrica, mais recente por ultimo — a base do "esta subindo ou caindo". */
const groupedEntries = computed(() => {
  const groups = new Map<string, MetricEntry[]>();
  for (const entry of entries.value) {
    const key = entry.channel ? `${entry.metric} · ${entry.channel}` : entry.metric;
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([label, list]) => ({
    label,
    entries: list,
    latest: list[list.length - 1]!,
    trend:
      list.length > 1
        ? list[list.length - 1]!.value - list[list.length - 2]!.value
        : null,
  }));
});

async function loadClients(): Promise<void> {
  try {
    clients.value = await client.listClients();
    if (!selectedClientId.value && clients.value.length > 0) {
      selectedClientId.value = clients.value[0]!.id;
    }
  } catch (error) {
    console.log("[client-metrics] falha ao carregar clientes", error);
  }
}

async function loadClientData(): Promise<void> {
  if (!selectedClientId.value) return;
  loadState.value = "loading";
  try {
    const [plans, list] = await Promise.all([
      client.getClientPlans(selectedClientId.value),
      client.listMetricEntries(selectedClientId.value, props.kind),
    ]);
    planoTrafego.value = plans.planoTrafego;
    frameworkPerformance.value = plans.frameworkPerformance;
    entries.value = list;
    loadState.value = "ready";
  } catch (error) {
    loadState.value = "error";
    console.log("[client-metrics] falha ao carregar dados do cliente", error);
  }
}

async function submitEntry(): Promise<void> {
  if (!selectedClientId.value || !metric.value.trim() || !value.value.trim()) {
    submitError.value = "Preencha ao menos a métrica e o valor.";
    return;
  }
  const numericValue = Number(value.value.replace(",", "."));
  if (Number.isNaN(numericValue)) {
    submitError.value = "Valor precisa ser um número.";
    return;
  }
  submitting.value = true;
  submitError.value = null;
  try {
    const created = await client.createMetricEntry(selectedClientId.value, {
      kind: props.kind,
      metric: metric.value.trim(),
      channel: channel.value.trim() || undefined,
      period: new Date(period.value).toISOString(),
      value: numericValue,
      note: note.value.trim() || undefined,
    });
    entries.value = [...entries.value, created];
    metric.value = "";
    channel.value = "";
    value.value = "";
    note.value = "";
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : "Não foi possível salvar.";
    console.log("[client-metrics] falha ao criar lançamento", error);
  } finally {
    submitting.value = false;
  }
}

async function removeEntry(id: string): Promise<void> {
  try {
    await client.deleteMetricEntry(id);
    entries.value = entries.value.filter((e) => e.id !== id);
  } catch (error) {
    console.log("[client-metrics] falha ao remover lançamento", error);
  }
}

async function loadGoogleAdsStatus(): Promise<void> {
  if (props.kind !== "TRAFEGO" || !selectedClientId.value) return;
  gadsLoadState.value = "loading";
  gadsAnalysis.value = null;
  gadsAnalysisState.value = "idle";
  gadsAppliedKeys.value = new Set();
  try {
    gadsStatus.value = await googleAds.getStatus(selectedClientId.value);
    gadsLoadState.value = "ready";
    if (gadsStatus.value.connected) {
      void loadGoogleAdsAnalysis();
    }
  } catch (error) {
    gadsLoadState.value = "error";
    console.log("[client-metrics] falha ao carregar status do Google Ads", error);
  }
}

async function loadGoogleAdsAnalysis(): Promise<void> {
  if (!selectedClientId.value) return;
  gadsAnalysisState.value = "loading";
  gadsAnalysisError.value = null;
  try {
    gadsAnalysis.value = await googleAds.getAnalysis(selectedClientId.value);
    gadsAnalysisState.value = "ready";
  } catch (error) {
    gadsAnalysisState.value = "error";
    gadsAnalysisError.value =
      error instanceof Error ? error.message : "Não foi possível consultar a conta.";
  }
}

function connectGoogleAds(): void {
  if (!selectedClientId.value || !gadsCustomerId.value.trim()) return;
  window.location.href = googleAds.buildConnectUrl(
    selectedClientId.value,
    gadsCustomerId.value.trim(),
    gadsLoginCustomerId.value.trim() || undefined,
  );
}

async function disconnectGoogleAds(): Promise<void> {
  if (!selectedClientId.value) return;
  gadsDisconnecting.value = true;
  try {
    await googleAds.disconnect(selectedClientId.value);
    await loadGoogleAdsStatus();
  } catch (error) {
    console.log("[client-metrics] falha ao desconectar Google Ads", error);
  } finally {
    gadsDisconnecting.value = false;
  }
}

async function applyGoogleAdsRecommendation(rec: NegativeKeywordRecommendation): Promise<void> {
  if (!selectedClientId.value) return;
  const key = gadsRecKey(rec);
  gadsApplyingKey.value = key;
  try {
    await googleAds.applyNegativeKeyword(selectedClientId.value, rec.campaignId, rec.term);
    gadsAppliedKeys.value = new Set([...gadsAppliedKeys.value, key]);
  } catch (error) {
    console.log("[client-metrics] falha ao aplicar palavra negativa", error);
  } finally {
    gadsApplyingKey.value = null;
  }
}

/** period e sempre meia-noite UTC do dia escolhido no input date — exibe em
 * UTC pra nao voltar um dia em fusos atras (ex: Brasil, UTC-3). */
function formatPeriod(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  });
}

watch(selectedClientId, () => {
  void loadClientData();
  void loadGoogleAdsStatus();
});

onMounted(() => {
  void loadClients().then(() => {
    void loadClientData();
    void loadGoogleAdsStatus();
  });
});
</script>

<template>
  <div class="op-metrics">
    <div class="op-metrics__head">
      <div>
        <h3 class="op-panel__title">{{ title }}</h3>
        <p class="op-metrics__hint">{{ hint }}</p>
      </div>
      <select v-model="selectedClientId" class="op-input op-metrics__select">
        <option v-if="clients.length === 0" :value="null">Nenhum cliente cadastrado ainda</option>
        <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }} · {{ c.nicheName }}</option>
      </select>
    </div>

    <p v-if="clients.length === 0" class="op-metrics__empty">
      Nenhum cliente rastreado ainda — crie uma campanha em Trabalhos e preencha o campo "Cliente"
      pra ele aparecer aqui.
    </p>

    <template v-else-if="selectedClient">
      <div v-if="kind === 'TRAFEGO' && activeTrafego" class="op-metrics__plan">
        <h4>Plano de referência (Mercúrio)</h4>
        <p><strong>Objetivo:</strong> {{ activeTrafego.objetivoCampanha }}</p>
        <p><strong>Plataforma principal:</strong> {{ activeTrafego.plataformaPrincipal }}</p>
        <div class="op-metrics__budget">
          <div v-for="b in activeTrafego.distribuicaoOrcamento" :key="b.conjunto" class="op-metrics__budget-row">
            <span>{{ b.conjunto }}</span>
            <div class="op-metrics__budget-bar"><div :style="{ width: b.percentual + '%' }" /></div>
            <span>{{ b.percentual }}%</span>
          </div>
        </div>
      </div>
      <div v-else-if="kind === 'TRAFEGO'" class="op-metrics__plan op-metrics__plan--empty">
        Este cliente ainda não tem um Plano de Tráfego Pago gerado (rode uma campanha completa em Trabalhos).
      </div>

      <div v-if="kind === 'PERFORMANCE' && activePerformance" class="op-metrics__plan">
        <h4>Métricas definidas pelo Mercúrio</h4>
        <table class="op-metrics__ref-table">
          <thead>
            <tr><th>Métrica</th><th>Canal</th><th>Frequência</th><th>Referência de mercado</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in activePerformance.metricas" :key="m.nome">
              <td>{{ m.nome }}</td>
              <td>{{ m.canal }}</td>
              <td>{{ m.frequencia }}</td>
              <td>{{ m.referenciaDeMercado }}</td>
            </tr>
          </tbody>
        </table>
        <p class="op-metrics__nota"><em>{{ activePerformance.notaImportante }}</em></p>
      </div>
      <div v-else-if="kind === 'PERFORMANCE'" class="op-metrics__plan op-metrics__plan--empty">
        Este cliente ainda não tem um Framework de Performance gerado (rode uma campanha completa em Trabalhos).
      </div>

      <div v-if="kind === 'TRAFEGO'" class="op-gads">
        <div class="op-gads__head">
          <h4>Google Ads</h4>
          <span v-if="gadsStatus?.connected" class="op-gads__badge op-gads__badge--on">
            conectado · {{ gadsStatus.customerId }}
          </span>
          <span v-else-if="gadsStatus?.configured" class="op-gads__badge">não conectado</span>
        </div>

        <p v-if="gadsLoadState === 'loading'" class="op-metrics__empty">Verificando conexão…</p>

        <p v-else-if="gadsStatus && !gadsStatus.configured" class="op-gads__note">
          Integração já implementada no backend (busca de termos sem conversão, sugestão de palavra
          negativa e leitura de impressão perdida), mas esta instância ainda não tem as credenciais
          de aplicação do Google Ads cadastradas. Assim que forem configuradas, a conexão fica
          disponível aqui — nenhuma mudança adicional será necessária.
        </p>

        <template v-else-if="gadsStatus">
          <form v-if="!gadsStatus.connected" class="op-gads__connect" @submit.prevent="connectGoogleAds">
            <input
              v-model="gadsCustomerId"
              type="text"
              class="op-input"
              placeholder="ID do cliente Google Ads (ex: 123-456-7890)"
            />
            <input
              v-model="gadsLoginCustomerId"
              type="text"
              class="op-input"
              placeholder="ID da conta gerenciadora (opcional)"
            />
            <button type="submit" class="op-btn op-btn--cta" :disabled="!gadsCustomerId.trim()">
              Conectar conta
            </button>
          </form>

          <template v-else>
            <p v-if="gadsStatus.lastError" class="op-error-inline">
              Última sincronização falhou: {{ gadsStatus.lastError }}
            </p>

            <p v-if="gadsAnalysisState === 'loading'" class="op-metrics__empty">Consultando a conta…</p>
            <p v-else-if="gadsAnalysisState === 'error'" class="op-error-inline">{{ gadsAnalysisError }}</p>

            <template v-else-if="gadsAnalysis">
              <div class="op-gads__summary">
                <div>
                  <span>Investimento (30d)</span>
                  <strong>R$ {{ gadsAnalysis.summary.costBrl.toFixed(2) }}</strong>
                </div>
                <div>
                  <span>Conversões</span>
                  <strong>{{ gadsAnalysis.summary.conversions }}</strong>
                </div>
                <div>
                  <span>Custo por conversão</span>
                  <strong>{{
                    gadsAnalysis.summary.costPerConversionBrl !== null
                      ? "R$ " + gadsAnalysis.summary.costPerConversionBrl.toFixed(2)
                      : "—"
                  }}</strong>
                </div>
              </div>

              <div v-if="gadsAnalysis.negativeKeywordRecommendations.length > 0" class="op-gads__block">
                <h5>Sugestões de palavra negativa</h5>
                <div
                  v-for="rec in gadsAnalysis.negativeKeywordRecommendations"
                  :key="gadsRecKey(rec)"
                  class="op-gads__rec"
                >
                  <div>
                    <strong>{{ rec.term }}</strong>
                    <span class="op-gads__rec-meta">{{ rec.campaignName }} · {{ rec.reason }}</span>
                  </div>
                  <button
                    type="button"
                    class="op-btn"
                    :disabled="gadsApplyingKey === gadsRecKey(rec) || gadsAppliedKeys.has(gadsRecKey(rec))"
                    @click="applyGoogleAdsRecommendation(rec)"
                  >
                    {{
                      gadsAppliedKeys.has(gadsRecKey(rec))
                        ? "Aplicada"
                        : gadsApplyingKey === gadsRecKey(rec)
                          ? "Aplicando…"
                          : "Negativar"
                    }}
                  </button>
                </div>
              </div>
              <p v-else class="op-metrics__empty">
                Nenhum termo com gasto sem conversão nos últimos 30 dias.
              </p>

              <div v-if="gadsAnalysis.lostImpressionShare.length > 0" class="op-gads__block">
                <h5>Impressão perdida por campanha</h5>
                <table class="op-metrics__ref-table">
                  <thead>
                    <tr>
                      <th>Campanha</th>
                      <th>Impressão</th>
                      <th>Perdida (orçamento)</th>
                      <th>Perdida (lance/qualidade)</th>
                      <th>Causa principal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in gadsAnalysis.lostImpressionShare" :key="row.campaignId">
                      <td>{{ row.campaignName }}</td>
                      <td class="op-mono">{{ row.impressionSharePct.toFixed(1) }}%</td>
                      <td class="op-mono">{{ row.lostToBudgetPct.toFixed(1) }}%</td>
                      <td class="op-mono">{{ row.lostToRankPct.toFixed(1) }}%</td>
                      <td>
                        {{
                          row.mainCause === "orcamento"
                            ? "Orçamento"
                            : row.mainCause === "lance_ou_qualidade"
                              ? "Lance/qualidade"
                              : "—"
                        }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

            <div class="op-gads__actions">
              <button
                type="button"
                class="op-btn"
                :disabled="gadsAnalysisState === 'loading'"
                @click="loadGoogleAdsAnalysis"
              >
                Atualizar análise
              </button>
              <button
                type="button"
                class="op-gads__disconnect"
                :disabled="gadsDisconnecting"
                @click="disconnectGoogleAds"
              >
                Desconectar
              </button>
            </div>
          </template>
        </template>
      </div>

      <form class="op-metrics__form" @submit.prevent="submitEntry">
        <input v-model="metric" type="text" class="op-input" placeholder="Métrica (ex: CPA, CTR, Investimento)" />
        <input v-model="channel" type="text" class="op-input" placeholder="Canal (opcional)" />
        <input v-model="period" type="date" class="op-input" />
        <input v-model="value" type="text" inputmode="decimal" class="op-input" placeholder="Valor" />
        <input v-model="note" type="text" class="op-input" placeholder="Nota (opcional)" />
        <button type="submit" class="op-btn op-btn--cta" :disabled="submitting">Lançar</button>
      </form>
      <p v-if="submitError" class="op-error-inline">{{ submitError }}</p>

      <p v-if="loadState === 'ready' && groupedEntries.length === 0" class="op-metrics__empty">
        Nenhum lançamento ainda para {{ selectedClient.name }}.
      </p>

      <div v-for="group in groupedEntries" :key="group.label" class="op-metrics__group">
        <div class="op-metrics__group-head">
          <span class="op-metrics__group-label">{{ group.label }}</span>
          <span class="op-metrics__group-latest">
            {{ group.latest.value }}
            <span
              v-if="group.trend !== null"
              :class="group.trend > 0 ? 'is-up' : group.trend < 0 ? 'is-down' : ''"
            >
              {{ group.trend > 0 ? "▲" : group.trend < 0 ? "▼" : "—" }}
            </span>
          </span>
        </div>
        <table class="op-metrics__entries-table">
          <tbody>
            <tr v-for="entry in group.entries" :key="entry.id">
              <td class="op-mono">{{ formatPeriod(entry.period) }}</td>
              <td class="op-mono">{{ entry.value }}</td>
              <td>{{ entry.note }}</td>
              <td><button type="button" class="op-metrics__remove" @click="removeEntry(entry.id)">remover</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.op-metrics__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.op-metrics__hint {
  font-size: 12.5px;
  color: var(--op-muted-3);
  margin: 0;
  max-width: 56ch;
}

.op-metrics__select {
  width: auto;
  min-width: 220px;
}

.op-metrics__empty {
  font-size: 13px;
  color: var(--op-muted-3);
  padding: 16px 0;
}

.op-metrics__plan {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  padding: 14px 16px;
  margin-bottom: 16px;
  font-size: 13px;
}

.op-metrics__plan--empty {
  color: var(--op-muted-3);
  font-style: italic;
}

.op-metrics__plan h4 {
  font-size: 13px;
  margin: 0 0 8px;
}

.op-metrics__budget {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.op-metrics__budget-row {
  display: grid;
  grid-template-columns: 140px 1fr 40px;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.op-metrics__budget-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--op-panel-2);
  overflow: hidden;
}

.op-metrics__budget-bar div {
  height: 100%;
  background: var(--op-cta);
}

.op-metrics__ref-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.op-metrics__ref-table th {
  text-align: left;
  color: var(--op-muted-3);
  font-weight: 600;
  padding: 4px 8px;
  border-bottom: 1px solid var(--op-line);
}

.op-metrics__ref-table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--op-line);
}

.op-metrics__nota {
  font-size: 11.5px;
  color: var(--op-muted-3);
  margin: 10px 0 0;
}

.op-metrics__form {
  display: grid;
  grid-template-columns: 1.4fr 1fr 130px 100px 1.4fr auto;
  gap: 8px;
  margin-bottom: 16px;
}

.op-metrics__group {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  padding: 10px 14px;
  margin-bottom: 10px;
}

.op-metrics__group-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.op-metrics__group-label {
  font-size: 13px;
  font-weight: 600;
}

.op-metrics__group-latest {
  font-family: "IBM Plex Mono", monospace;
  font-size: 13px;
  font-weight: 700;
}

.op-metrics__group-latest .is-up {
  color: var(--op-green);
}

.op-metrics__group-latest .is-down {
  color: var(--op-red);
}

.op-metrics__entries-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.op-metrics__entries-table td {
  padding: 4px 8px;
  color: var(--op-muted-3);
}

.op-metrics__remove {
  background: none;
  border: none;
  color: var(--op-muted-3);
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
}

@media (max-width: 900px) {
  .op-metrics__form {
    grid-template-columns: 1fr 1fr;
  }
}

.op-gads {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  padding: 14px 16px;
  margin-bottom: 16px;
}

.op-gads__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.op-gads__head h4 {
  font-size: 13px;
  margin: 0;
}

.op-gads__badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--op-muted-3);
  border: 1px solid var(--op-line);
  border-radius: 999px;
  padding: 2px 10px;
}

.op-gads__badge--on {
  color: var(--op-green);
  border-color: var(--op-green);
}

.op-gads__note {
  font-size: 12.5px;
  color: var(--op-muted-3);
  margin: 0;
  max-width: 64ch;
}

.op-gads__connect {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
}

.op-gads__summary {
  display: flex;
  gap: 24px;
  margin-bottom: 14px;
}

.op-gads__summary > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.op-gads__summary span {
  font-size: 11px;
  color: var(--op-muted-3);
}

.op-gads__summary strong {
  font-family: "IBM Plex Mono", monospace;
  font-size: 15px;
}

.op-gads__block {
  margin-bottom: 14px;
}

.op-gads__block h5 {
  font-size: 12px;
  color: var(--op-muted-3);
  margin: 0 0 8px;
}

.op-gads__rec {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--op-line);
  font-size: 12.5px;
}

.op-gads__rec:last-child {
  border-bottom: none;
}

.op-gads__rec-meta {
  display: block;
  font-size: 11.5px;
  color: var(--op-muted-3);
  margin-top: 2px;
}

.op-gads__actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.op-gads__disconnect {
  background: none;
  border: none;
  color: var(--op-red);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

@media (max-width: 900px) {
  .op-gads__connect {
    grid-template-columns: 1fr;
  }

  .op-gads__summary {
    flex-wrap: wrap;
    gap: 16px;
  }
}
</style>
