<script setup lang="ts">
/**
 * Sala da Opera (Interface 3.0) — substitui a ExecutiveRoom do layout antigo.
 *
 * - Painel "O que a Opera está vendo": GET /office/ceo/briefing (real).
 * - Chat: POST /office/ceo/chat. Conversa NAO cria missao; quando o pedido
 *   e trabalho, a Opera propoe uma demanda e a usuaria leva para "Nova
 *   demanda" ja preenchida (risco + aprovacao seguem o fluxo normal).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { createHttpClient } from "@/data/adapters/http-client";
import { CAST } from "@/modules/office-3d/floors-3d";
import { PORTARIA } from "@/data/office-floors";
import { renderChatText } from "@/lib/chat-text";

interface Health {
  level: string;
  label: string;
  summary: string;
  workersAlive: number;
  workersExpected: number;
  queued: number;
  running: number;
  waiting: number;
}
interface Approval { id: string; title: string; risk: string; workspaceName: string; createdAt: string }
interface Mission { id: string; workspaceName: string; objective: string; human: boolean; at: string }
interface Failure extends Mission { error: string }
interface Delivery {
  missionId: string;
  rootMissionId: string | null;
  workspaceName: string;
  employeeId: string;
  request: string;
  summary: string;
  recommendations: string[];
  finishedAt: string;
}
interface FloorRun { id: string; floor: "automation" | "marketing"; title: string; status: string; allFallback: boolean; createdAt: string }
interface Project { workspaceId: string; name: string; missions24h: number; failures24h: number }
interface Briefing {
  generatedAt: string;
  health: Health | null;
  approvalsPending: Approval[];
  running: Mission[];
  queued: Mission[];
  deliveries: Delivery[];
  failures: Failure[];
  counts24h: { completed: number; failed: number; human: number; automatic: number };
  floorRuns: FloorRun[];
  storeFlow: { niche: string; pending: number; approved: number; rejected: number; updatedAt: string } | null;
  projects: Project[];
}
interface SuggestedDemand { workspaceId: string; workspaceName: string; text: string }
interface Turn {
  role: "user" | "opera";
  text: string;
  at: string;
  usedAi?: boolean;
  demand?: SuggestedDemand | null;
  error?: boolean;
}

const http = createHttpClient();
const router = useRouter();
const opera = CAST["operaia-ceo"]!;

const briefing = ref<Briefing | null>(null);
const briefingError = ref<string | null>(null);
const loadingBriefing = ref(true);

const STORE_KEY = "operaia.sala-opera.v1";
function readStored(): Turn[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Turn[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-30) : [];
  } catch {
    return [];
  }
}
function store(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(turns.value.slice(-30)));
  } catch {
    /* navegador sem armazenamento: a conversa vale so nesta aba */
  }
}

const turns = ref<Turn[]>(readStored());
const draft = ref("");
const sending = ref(false);
const thread = ref<HTMLElement | null>(null);
const waitSeconds = ref(0);
let waitTimer: ReturnType<typeof setInterval> | null = null;

async function loadBriefing(): Promise<void> {
  try {
    briefing.value = await http.get<Briefing>("/office/ceo/briefing");
    briefingError.value = null;
  } catch (err) {
    briefingError.value = err instanceof Error ? err.message : "Não foi possível ler o escritório agora.";
  } finally {
    loadingBriefing.value = false;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  void loadBriefing();
  timer = setInterval(() => void loadBriefing(), 30_000);
  void scrollDown();
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

async function scrollDown(): Promise<void> {
  await nextTick();
  if (thread.value) thread.value.scrollTop = thread.value.scrollHeight;
}

async function send(text?: string): Promise<void> {
  const message = (text ?? draft.value).trim();
  if (!message || sending.value) return;
  const history = turns.value.filter((t) => !t.error).slice(-8).map((t) => ({ role: t.role, text: t.text }));
  turns.value.push({ role: "user", text: message, at: new Date().toISOString() });
  draft.value = "";
  sending.value = true;
  waitSeconds.value = 0;
  waitTimer = setInterval(() => (waitSeconds.value += 1), 1000);
  store();
  void scrollDown();
  try {
    const res = await http.post<{ answer: string; usedAi: boolean; suggestedDemand: SuggestedDemand | null }>(
      "/office/ceo/chat",
      { message, history },
    );
    turns.value.push({ role: "opera", text: res.answer, at: new Date().toISOString(), usedAi: res.usedAi, demand: res.suggestedDemand });
  } catch (err) {
    turns.value.push({
      role: "opera",
      text: `Não consegui responder agora: ${err instanceof Error ? err.message : "erro de conexão"}. Tente de novo.`,
      at: new Date().toISOString(),
      error: true,
    });
  } finally {
    sending.value = false;
    if (waitTimer) clearInterval(waitTimer);
    store();
    void scrollDown();
    void loadBriefing();
  }
}

function onKey(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void send();
  }
}

function newConversation(): void {
  turns.value = [];
  store();
}

function toDemand(d: SuggestedDemand): void {
  void router.push({ path: "/app/floor/dev/command/new", query: { workspace: d.workspaceId, text: d.text } });
}

const greetingText = computed(() => {
  const b = briefing.value;
  if (!b) return "Estou olhando o escritório inteiro. Pergunte o que quiser — prioridades, entregas, falhas, um projeto específico.";
  const parts: string[] = [];
  if (b.approvalsPending.length) parts.push(`**${b.approvalsPending.length} aprovação(ões)** esperando você`);
  if (b.failures.length) parts.push(`**${b.failures.length} falha(s)** nas últimas 24h`);
  if (b.running.length) parts.push(`${b.running.length} trabalho(s) rodando agora`);
  return parts.length
    ? `Agora no escritório: ${parts.join(", ")}. Quer que eu explique algum ponto?`
    : "Escritório tranquilo: nada esperando você e nenhuma falha nas últimas 24h. Quer revisar prioridades ou pedir algo à equipe?";
});

const suggestions = computed(() => {
  const b = briefing.value;
  const list: string[] = [];
  if (b?.approvalsPending.length || b?.storeFlow?.pending) list.push("O que está esperando minha aprovação e o que você recomenda?");
  if (b?.failures.length) list.push("Por que houve falhas hoje e o que fazer?");
  list.push("O que a equipe entregou nesta semana?");
  list.push("Qual projeto precisa de atenção agora?");
  const busiest = [...(b?.projects ?? [])].sort((x, y) => y.missions24h - x.missions24h)[0];
  if (busiest && busiest.missions24h > 0) list.push(`Como está o ${busiest.name}?`);
  return list.slice(0, 4);
});

const RISK_LABEL: Record<string, string> = { LOW: "baixo", MEDIUM: "médio", HIGH: "alto", CRITICAL: "crítico" };
const STATUS_LABEL: Record<string, string> = { DONE: "concluído", RUNNING: "rodando", PENDING: "na fila", FAILED: "falhou" };
const healthTone = computed(() => {
  const l = briefing.value?.health?.level;
  if (!l) return "";
  return l === "PROBLEM" ? "is-problem" : l === "ATTENTION" ? "is-attention" : "is-ok";
});

function who(id: string): string {
  return (CAST as Record<string, { name: string } | undefined>)[id]?.name ?? id;
}
function when(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString("pt-BR", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <div class="so">
    <header class="so__head">
      <div class="so__intro">
        <p class="so__eyebrow">TÉRREO · SALA DA OPERA</p>
        <h1 class="so__title">Sala da Opera</h1>
        <p class="so__lead">Converse com a CEO. Ela responde com o que está acontecendo de verdade no escritório agora.</p>
      </div>
      <div class="so__actions">
        <router-link :to="PORTARIA.homeRoute" class="so__btn">Visão do prédio</router-link>
        <router-link to="/app/floor/dev/command/new" class="so__btn so__btn--primary">+ Nova demanda</router-link>
      </div>
    </header>

    <div class="so__grid">
      <!-- Conversa -------------------------------------------------------->
      <section class="so__chat" aria-label="Conversa com a Opera">
        <div class="so__chat-head">
          <img :src="opera.sprite" alt="" class="so__avatar" width="40" height="40" />
          <div class="so__who">
            <p class="so__who-name">Opera</p>
            <p class="so__who-role">CEO · vê os 4 andares e os {{ briefing?.projects.length ?? 17 }} projetos</p>
          </div>
          <button v-if="turns.length" type="button" class="so__link" @click="newConversation">Nova conversa</button>
        </div>

        <div ref="thread" class="so__thread" aria-live="polite">
          <div class="so__msg so__msg--opera">
            <div class="so__bubble" v-html="renderChatText(greetingText)" />
          </div>
          <div v-for="(t, i) in turns" :key="i" class="so__msg" :class="t.role === 'user' ? 'so__msg--user' : 'so__msg--opera'">
            <div class="so__bubble" :class="{ 'is-error': t.error }" v-html="renderChatText(t.text)" />
            <div v-if="t.demand" class="so__demand">
              <p class="so__demand-text">Demanda sugerida para <strong>{{ t.demand.workspaceName }}</strong>: “{{ t.demand.text }}”</p>
              <button type="button" class="so__btn so__btn--primary so__btn--sm" @click="toDemand(t.demand)">Transformar em demanda</button>
            </div>
            <p class="so__meta">
              {{ t.role === "user" ? "Você" : "Opera" }} · {{ when(t.at) }}
              <template v-if="t.role === 'opera' && !t.error && t.usedAi === false"> · sem IA, só fatos do escritório</template>
            </p>
          </div>
          <div v-if="sending" class="so__msg so__msg--opera">
            <div class="so__bubble so__typing">
              Opera está olhando o escritório… {{ waitSeconds }}s
              <template v-if="waitSeconds >= 12"><br />A IA está lenta agora (limite da conta). Se passar de 40 s, respondo só com os fatos.</template>
            </div>
          </div>
        </div>

        <div v-if="!turns.length" class="so__suggest" role="group" aria-label="Sugestões">
          <button v-for="s in suggestions" :key="s" type="button" class="so__chip" :disabled="sending" @click="send(s)">{{ s }}</button>
        </div>

        <form class="so__composer" @submit.prevent="send()">
          <label for="so-input" class="so__sr">Mensagem para a Opera</label>
          <textarea
            id="so-input"
            v-model="draft"
            rows="2"
            maxlength="2000"
            placeholder="Pergunte ou peça algo à Opera… (Enter envia, Shift+Enter quebra linha)"
            :disabled="sending"
            @keydown="onKey"
          />
          <button type="submit" class="so__btn so__btn--primary" :disabled="sending || !draft.trim()">
            {{ sending ? "Enviando…" : "Enviar" }}
          </button>
        </form>
      </section>

      <!-- O que a Opera esta vendo ---------------------------------------->
      <aside class="so__side" aria-label="O que a Opera está vendo">
        <p class="so__side-title">O QUE A OPERA ESTÁ VENDO</p>
        <p v-if="loadingBriefing && !briefing" class="so__muted">Lendo o escritório…</p>
        <p v-else-if="briefingError && !briefing" class="so__error" role="alert">{{ briefingError }}</p>

        <template v-if="briefing">
          <div class="so__card">
            <p class="so__card-title">Saúde</p>
            <p class="so__health" :class="healthTone">{{ briefing.health?.label ?? "Indisponível" }}</p>
            <p v-if="briefing.health" class="so__muted">
              {{ briefing.health.workersAlive }}/{{ briefing.health.workersExpected }} workers no posto ·
              {{ briefing.health.queued }} na fila · {{ briefing.health.running }} rodando
            </p>
            <p class="so__muted">24h: {{ briefing.counts24h.completed }} concluídas · {{ briefing.counts24h.failed }} falhas · {{ briefing.counts24h.human }} pedidas por você</p>
          </div>

          <div class="so__card">
            <p class="so__card-title">Esperando você <span class="so__count">{{ briefing.approvalsPending.length }}</span></p>
            <p v-if="!briefing.approvalsPending.length" class="so__muted">Nada esperando sua decisão.</p>
            <ul v-else class="so__list">
              <li v-for="a in briefing.approvalsPending.slice(0, 5)" :key="a.id">
                <router-link :to="`/app/floor/dev/command/approvals/${a.id}`" class="so__item-link">{{ a.title }}</router-link>
                <span class="so__item-meta">{{ a.workspaceName }} · risco <span :class="`so__risk is-${a.risk.toLowerCase()}`">{{ RISK_LABEL[a.risk] ?? a.risk }}</span></span>
              </li>
            </ul>
          </div>

          <div class="so__card">
            <p class="so__card-title">Agora <span class="so__count">{{ briefing.running.length + briefing.queued.length }}</span></p>
            <p v-if="!briefing.running.length && !briefing.queued.length" class="so__muted">Ninguém trabalhando neste momento.</p>
            <ul v-else class="so__list">
              <li v-for="m in [...briefing.running, ...briefing.queued].slice(0, 5)" :key="m.id">
                <router-link :to="`/app/floor/dev/missions/${m.id}`" class="so__item-link">{{ m.objective }}</router-link>
                <span class="so__item-meta">{{ m.workspaceName }} · {{ briefing.running.includes(m) ? "rodando" : "na fila" }}</span>
              </li>
            </ul>
          </div>

          <div class="so__card">
            <p class="so__card-title">Entregas para você · 7 dias <span class="so__count">{{ briefing.deliveries.length }}</span></p>
            <p v-if="!briefing.deliveries.length" class="so__muted">Nenhuma demanda sua concluída nos últimos 7 dias.</p>
            <ul v-else class="so__list">
              <li v-for="d in briefing.deliveries.slice(0, 5)" :key="d.missionId">
                <router-link :to="`/app/floor/dev/missions/${d.rootMissionId ?? d.missionId}`" class="so__item-link">{{ d.request }}</router-link>
                <span v-if="d.summary" class="so__item-body">{{ d.summary }}</span>
                <span v-else class="so__item-warn">Entrega sem conteúdo útil (foi feita sem IA). Vale pedir de novo.</span>
                <span class="so__item-meta">{{ who(d.employeeId) }} · {{ d.workspaceName }} · {{ when(d.finishedAt) }}</span>
              </li>
            </ul>
          </div>

          <div v-if="briefing.failures.length" class="so__card">
            <p class="so__card-title">Falhas · 24h <span class="so__count is-red">{{ briefing.failures.length }}</span></p>
            <ul class="so__list">
              <li v-for="f in briefing.failures.slice(0, 5)" :key="f.id">
                <router-link :to="`/app/floor/dev/missions/${f.id}`" class="so__item-link">{{ f.objective }}</router-link>
                <span class="so__item-warn">{{ f.error }}</span>
                <span class="so__item-meta">{{ f.workspaceName }} · {{ when(f.at) }}</span>
              </li>
            </ul>
          </div>

          <div v-if="briefing.storeFlow" class="so__card">
            <p class="so__card-title">Store Flow · afiliados <span class="so__count">{{ briefing.storeFlow.pending }}</span></p>
            <router-link to="/app/floor/store-flow/work" class="so__item-link">
              {{ briefing.storeFlow.pending ? `${briefing.storeFlow.pending} post(s) esperando sua aprovação` : "Nenhum post esperando aprovação" }}
            </router-link>
            <span class="so__item-meta">Rodada “{{ briefing.storeFlow.niche }}” · {{ briefing.storeFlow.approved }} aprovados · {{ briefing.storeFlow.rejected }} recusados</span>
          </div>

          <div v-if="briefing.floorRuns.length" class="so__card">
            <p class="so__card-title">Atlas e Mercúrio · 7 dias</p>
            <ul class="so__list">
              <li v-for="r in briefing.floorRuns.slice(0, 5)" :key="r.id">
                <router-link
                  :to="r.floor === 'automation' ? '/app/floor/automation/clients' : '/app/floor/marketing/work'"
                  class="so__item-link"
                >{{ r.title }}</router-link>
                <span v-if="r.allFallback" class="so__item-warn">Todas as etapas sem IA — refazer.</span>
                <span class="so__item-meta">{{ r.floor === "automation" ? "Atlas · automação" : "Mercúrio · marketing" }} · {{ STATUS_LABEL[r.status] ?? r.status }} · {{ when(r.createdAt) }}</span>
              </li>
            </ul>
          </div>

          <p class="so__muted so__stamp">Atualizado às {{ when(briefing.generatedAt) }} · atualiza sozinho a cada 30 s</p>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.so {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 36px var(--op-gutter, 34px) 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  font-family: "Sora", sans-serif;
  color: var(--op-ink-3);
}

.so > * {
  flex-shrink: 0;
}

.so__head {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-end;
  justify-content: space-between;
}

.so__intro {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.so__eyebrow,
.so__side-title,
.so__card-title {
  margin: 0;
  font-family: var(--op-font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--op-muted-3);
  font-weight: 500;
}

.so__title {
  margin: 0;
  font-size: 36px;
  line-height: 1.1;
  font-weight: 600;
  color: var(--op-ink);
}

.so__lead {
  margin: 0;
  font-size: 14px;
  color: var(--op-muted-2);
  max-width: 620px;
}

.so__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.so__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  background: transparent;
  color: var(--op-ink-3);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
}

.so__btn:hover {
  border-color: var(--op-bd-btn-h);
}

.so__btn--primary {
  border-color: transparent;
  background: var(--op-cta);
  color: #fff;
  font-weight: 600;
}

.so__btn--primary:hover {
  background: var(--op-cta-h);
}

.so__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.so__btn--sm {
  min-height: 34px;
  padding: 0 12px;
  font-size: 13px;
}

.so__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.so__chat {
  display: flex;
  flex-direction: column;
  min-height: 560px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.so__chat-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--op-line);
}

.so__avatar {
  width: 40px;
  height: 40px;
  image-rendering: pixelated;
  border-radius: 10px;
  background: var(--op-raise);
}

.so__who {
  flex: 1;
  min-width: 0;
}

.so__who-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--op-ink);
}

.so__who-role {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--op-muted-2);
}

.so__link {
  border: 0;
  background: none;
  color: var(--op-blue);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.so__thread {
  flex: 1;
  max-height: min(62vh, 640px);
  min-height: 300px;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.so__msg {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 88%;
}

.so__msg--user {
  align-self: flex-end;
  align-items: flex-end;
}

.so__bubble {
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.55;
  overflow-wrap: anywhere;
  background: var(--op-raise);
  color: var(--op-ink-3);
}

.so__msg--user .so__bubble {
  background: var(--op-cta);
  color: #fff;
}

.so__bubble.is-error {
  border: 1px solid var(--op-red);
  color: var(--op-red);
  background: transparent;
}

.so__bubble :deep(p),
.so__bubble :deep(li),
.so__bubble :deep(strong) {
  color: inherit;
}

.so__bubble :deep(p) {
  margin: 0 0 6px;
}

.so__bubble :deep(p:last-child) {
  margin-bottom: 0;
}

.so__bubble :deep(ul) {
  margin: 4px 0 6px;
  padding-left: 18px;
}

.so__typing {
  color: var(--op-muted-2);
  font-style: italic;
}

.so__meta {
  margin: 0;
  font-family: var(--op-font-mono);
  font-size: 11px;
  color: var(--op-muted-3);
}

.so__demand {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px dashed var(--op-bd-chip);
  border-radius: 12px;
}

.so__demand-text {
  flex: 1 1 220px;
  margin: 0;
  font-size: 13px;
  color: var(--op-ink-3);
  overflow-wrap: anywhere;
}

.so__suggest {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 20px 14px;
}

.so__chip {
  min-height: 34px;
  padding: 6px 12px;
  border: 1px solid var(--op-bd-chip);
  border-radius: var(--op-radius-full);
  background: transparent;
  color: var(--op-ink-3);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.so__chip:hover {
  border-color: var(--op-bd-sel);
  background: var(--op-sel);
}

.so__composer {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--op-line);
}

.so__composer textarea {
  flex: 1;
  min-width: 0;
  resize: vertical;
  min-height: 46px;
  max-height: 200px;
  padding: 11px 14px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  background: transparent;
  color: var(--op-ink-3);
  font: inherit;
  font-size: 14px;
  line-height: 1.45;
}

.so__composer textarea:focus {
  outline: none;
  border-color: var(--op-bd-sel);
}

.so__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.so__side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.so__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.so__count {
  margin-left: 6px;
  color: var(--op-ink-3);
}

.so__count.is-red {
  color: var(--op-red);
}

.so__health {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--op-ink);
}

.so__health.is-ok {
  color: var(--op-green);
}

.so__health.is-attention {
  color: var(--op-amber);
}

.so__health.is-problem {
  color: var(--op-red);
}

.so__muted {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--op-muted-2);
}

.so__error {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--op-red);
  border-radius: var(--op-radius-sm);
  color: var(--op-red);
  font-size: 13px;
}

.so__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.so__list li {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.so__item-link {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--op-ink-3);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.so__item-link:hover {
  color: var(--op-blue);
}

.so__item-body {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--op-muted-2);
  overflow-wrap: anywhere;
}

.so__item-warn {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--op-amber);
  overflow-wrap: anywhere;
}

.so__item-meta {
  font-family: var(--op-font-mono);
  font-size: 11px;
  color: var(--op-muted-3);
  overflow-wrap: anywhere;
}

.so__risk.is-high,
.so__risk.is-critical {
  color: var(--op-red);
}

.so__risk.is-medium {
  color: var(--op-amber);
}

.so__stamp {
  font-size: 11.5px;
}

@media (max-width: 980px) {
  .so__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .so {
    padding-top: 20px;
    gap: 18px;
  }

  .so__title {
    font-size: 28px;
  }

  .so__chat {
    min-height: 0;
  }

  .so__thread {
    max-height: 60vh;
    padding: 14px;
  }

  .so__msg {
    max-width: 100%;
  }

  .so__composer {
    padding: 12px 14px 14px;
  }
}
</style>
