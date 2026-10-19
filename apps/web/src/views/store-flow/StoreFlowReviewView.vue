<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  CHANNEL_LABEL,
  SIGNAL_LABEL,
  approvalBlocker,
  countByStatus,
  decide,
  exportApproved,
  loadSavedRun,
  parseRun,
  reopen,
  replaceDraft,
  saveRun,
  type DraftStatus,
  type ReviewCurated,
  type ReviewDraft,
  type ReviewRun,
} from "@/modules/store-flow/review-queue";

type Filter = DraftStatus;

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: "PENDING_APPROVAL", label: "Pendentes" },
  { id: "APPROVED", label: "Aprovados" },
  { id: "REJECTED", label: "Recusados" },
];

const run = ref<ReviewRun | null>(loadSavedRun());
const filter = ref<Filter>("PENDING_APPROVAL");
const edits = ref<Record<string, string>>({});
const loadError = ref<string | null>(null);
const actionError = ref<Record<string, string>>({});
const copiedId = ref<string | null>(null);

watch(run, (value) => saveRun(value), { deep: true });

const counts = computed(() =>
  run.value ? countByStatus(run.value) : { PENDING_APPROVAL: 0, APPROVED: 0, REJECTED: 0 },
);

const productsById = computed(
  () => new Map((run.value?.curated ?? []).map((c) => [c.product.id, c] as const)),
);

const visibleDrafts = computed(() =>
  (run.value?.drafts ?? []).filter((d) => d.status === filter.value),
);

const pendingLinks = computed(
  () => (run.value?.curated ?? []).filter((c) => c.linkPending).length,
);

function textOf(draft: ReviewDraft): string {
  return edits.value[draft.id] ?? draft.text;
}

function blockerOf(draft: ReviewDraft): string | null {
  return approvalBlocker(draft, textOf(draft), { linkPending: linkPendingOf(draft) });
}

function linkPendingOf(draft: ReviewDraft): boolean {
  return productOf(draft)?.linkPending === true;
}

function productOf(draft: ReviewDraft): ReviewCurated | undefined {
  return productsById.value.get(draft.productId);
}

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    run.value = parseRun(await file.text());
    edits.value = {};
    actionError.value = {};
    loadError.value = null;
    filter.value = "PENDING_APPROVAL";
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "Não deu para ler o arquivo.";
  }
}

function apply(draft: ReviewDraft, next: () => ReviewDraft): void {
  if (!run.value) return;
  try {
    run.value = replaceDraft(run.value, next());
    const { [draft.id]: _edit, ...restEdits } = edits.value;
    const { [draft.id]: _err, ...restErrors } = actionError.value;
    void _edit;
    void _err;
    edits.value = restEdits;
    actionError.value = restErrors;
  } catch (error) {
    actionError.value = {
      ...actionError.value,
      [draft.id]: error instanceof Error ? error.message : "Não foi possível salvar.",
    };
  }
}

function approve(draft: ReviewDraft): void {
  apply(draft, () => decide(draft, "APPROVED", textOf(draft), { linkPending: linkPendingOf(draft) }));
}

function rejectDraft(draft: ReviewDraft): void {
  apply(draft, () => decide(draft, "REJECTED", textOf(draft)));
}

function undo(draft: ReviewDraft): void {
  apply(draft, () => reopen(draft));
}

async function copy(draft: ReviewDraft): Promise<void> {
  try {
    await navigator.clipboard.writeText(draft.text);
    copiedId.value = draft.id;
    setTimeout(() => {
      if (copiedId.value === draft.id) copiedId.value = null;
    }, 1800);
  } catch {
    actionError.value = { ...actionError.value, [draft.id]: "Não deu para copiar. Selecione o texto e copie." };
  }
}

function downloadApproved(): void {
  if (!run.value) return;
  const blob = new Blob([exportApproved(run.value)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "store-flow-aprovados.json";
  a.click();
  URL.revokeObjectURL(url);
}

function clearRun(): void {
  run.value = null;
  edits.value = {};
  actionError.value = {};
}
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Store Flow › Sala de Aprovação</p>
        <h1 class="page__title">Aprovar posts</h1>
      </div>
      <div class="fs__actions">
        <router-link to="/app/store-flow" class="btn btn--ghost">Painel do andar</router-link>
        <label class="btn btn--ghost fs__upload">
          {{ run ? "Carregar outra rodada" : "Carregar rodada (.json)" }}
          <input type="file" accept="application/json,.json" class="sr-only" @change="onFile" />
        </label>
        <button
          v-if="run"
          type="button"
          class="btn btn--primary"
          :disabled="counts.APPROVED === 0"
          @click="downloadApproved"
        >
          Baixar aprovados ({{ counts.APPROVED }})
        </button>
      </div>
    </header>

    <div class="studio__stage">
      <p v-if="loadError" class="panel fs__alert fs__alert--danger" role="alert">{{ loadError }}</p>

      <section v-if="!run" class="panel fs__empty">
        <h2 class="section__title">Nenhuma rodada carregada</h2>
        <ol class="fs__steps">
          <li>
            Na VM, rode
            <code>pnpm --filter @operaia/store-flow run:csv -- produtos.csv --nicho "..." --canais instagram</code>
          </li>
          <li>Clique em <strong>Carregar rodada</strong> e escolha o arquivo <code>.json</code> gerado.</li>
          <li>Revise cada texto: aprove, edite ou recuse.</li>
        </ol>
      </section>

      <template v-else>
        <p v-if="pendingLinks > 0" class="panel fs__alert fs__alert--warn">
          {{ pendingLinks }} produto(s) ainda sem link rastreado. No texto, troque a URL do produto pelo
          seu link de afiliado (copie do portal) antes de aprovar.
        </p>

        <p v-if="run.drafts.some((d) => d.variant)" class="panel fs__alert fs__ab">
          Teste A/B: cada post tem a versão A e a B, com ângulos e horários diferentes. Publique as duas
          nos horários sugeridos e depois rode <code>aprender</code> com o relatório do portal para saber
          qual vendeu mais.
        </p>

        <nav class="fs__tabs" aria-label="Filtrar rascunhos">
          <button
            v-for="f in FILTERS"
            :key="f.id"
            type="button"
            class="chip fs__tab"
            :class="{ 'fs__tab--active': filter === f.id }"
            :aria-pressed="filter === f.id"
            @click="filter = f.id"
          >
            {{ f.label }} · {{ counts[f.id] }}
          </button>
          <button type="button" class="btn btn--ghost fs__clear" @click="clearRun">Limpar fila</button>
        </nav>

        <p v-if="visibleDrafts.length === 0" class="panel fs__empty-filter">
          {{ filter === "PENDING_APPROVAL" ? "Tudo revisado. Baixe os aprovados para publicar." : "Nada aqui ainda." }}
        </p>

        <article v-for="draft in visibleDrafts" :key="draft.id" class="panel fs__card">
          <header class="fs__card-head">
            <div>
              <p class="eyebrow">
                {{ CHANNEL_LABEL[draft.channel] }}
                <template v-if="draft.variant"> · Versão {{ draft.variant }}</template>
                <template v-if="draft.suggestedTime"> · publicar às {{ draft.suggestedTime }}</template>
              </p>
              <h2 class="fs__product">{{ productOf(draft)?.product.title ?? draft.productId }}</h2>
            </div>
            <div class="fs__chips">
              <span v-if="productOf(draft)" class="chip chip--ok">
                Nota Flow {{ productOf(draft)!.score }}
              </span>
              <span v-if="productOf(draft)" class="chip">
                ≈ {{ brl(productOf(draft)!.estimatedCommission) }} por venda
              </span>
              <span v-if="draft.angleLabel" class="chip">Ângulo: {{ draft.angleLabel }}</span>
              <span v-for="sig in productOf(draft)?.signals ?? []" :key="sig" class="chip chip--ok">
                {{ SIGNAL_LABEL[sig] ?? sig }}
              </span>
              <span v-if="draft.source === 'template'" class="chip chip--warn">Texto modelo</span>
              <span v-if="linkPendingOf(draft) && draft.status === 'PENDING_APPROVAL'" class="chip chip--warn">Link sem rastreio</span>
            </div>
          </header>

          <ul v-if="productOf(draft)" class="fs__reasons">
            <li v-for="reason in productOf(draft)!.reasons" :key="reason">{{ reason }}</li>
          </ul>

          <label class="sr-only" :for="`text-${draft.id}`">Texto do post</label>
          <textarea
            :id="`text-${draft.id}`"
            class="fs__text"
            :readonly="draft.status !== 'PENDING_APPROVAL'"
            :value="textOf(draft)"
            rows="8"
            @input="edits[draft.id] = ($event.target as HTMLTextAreaElement).value"
          />

          <p v-if="draft.status === 'PENDING_APPROVAL' && blockerOf(draft)" class="fs__hint" role="status">
            {{ blockerOf(draft) }}
          </p>
          <p v-if="actionError[draft.id]" class="fs__hint fs__hint--danger" role="alert">
            {{ actionError[draft.id] }}
          </p>

          <footer class="fs__card-actions">
            <template v-if="draft.status === 'PENDING_APPROVAL'">
              <button
                type="button"
                class="btn btn--approve"
                :disabled="blockerOf(draft) !== null"
                @click="approve(draft)"
              >
                Aprovar
              </button>
              <button type="button" class="btn btn--danger" @click="rejectDraft(draft)">Recusar</button>
            </template>
            <template v-else>
              <button v-if="draft.status === 'APPROVED'" type="button" class="btn btn--primary" @click="copy(draft)">
                {{ copiedId === draft.id ? "Copiado!" : "Copiar texto" }}
              </button>
              <button type="button" class="btn btn--ghost" @click="undo(draft)">Voltar para pendente</button>
            </template>
            <a :href="draft.affiliateUrl" target="_blank" rel="noopener noreferrer" class="btn btn--ghost">
              Abrir produto
            </a>
          </footer>
        </article>

        <details v-if="run.rejected.length > 0" class="panel fs__rejected">
          <summary>Produtos que a Flow recusou ({{ run.rejected.length }})</summary>
          <ul>
            <li v-for="r in run.rejected" :key="r.productId">
              <strong>{{ r.title || r.productId }}</strong> — {{ r.reason }}
            </li>
          </ul>
        </details>
      </template>
    </div>
  </div>
</template>

<style scoped>
.fs__actions,
.fs__card-actions,
.fs__chips,
.fs__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.fs__upload {
  cursor: pointer;
}

.fs__alert,
.fs__empty,
.fs__empty-filter,
.fs__rejected {
  padding: 16px 18px;
  margin-bottom: 14px;
}

.fs__alert--warn {
  border-color: var(--warning);
  background: var(--warning-soft);
}

.fs__alert--danger {
  border-color: var(--danger);
  background: var(--danger-soft);
}

.fs__steps {
  margin: 10px 0 0;
  padding-left: 20px;
  color: var(--text-muted);
  line-height: 1.7;
}

.fs__steps code,
.fs__empty code {
  font-size: 0.85em;
  word-break: break-word;
}

.fs__tabs {
  margin-bottom: 14px;
}

.fs__tab {
  cursor: pointer;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-muted);
}

.fs__tab--active {
  background: var(--brand-soft);
  border-color: var(--brand-line);
  color: var(--text);
}

.fs__clear {
  margin-left: auto;
}

.fs__card {
  padding: 18px;
  margin-bottom: 14px;
  display: grid;
  gap: 12px;
}

.fs__card-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px;
}

.fs__product {
  margin: 2px 0 0;
  font-size: 1.05rem;
}

.fs__reasons {
  margin: 0;
  padding-left: 18px;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.fs__ab {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.fs__text {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  line-height: 1.5;
}

.fs__text:read-only {
  opacity: 0.8;
}

.fs__hint {
  margin: 0;
  color: var(--warning);
  font-size: 0.9rem;
}

.fs__hint--danger {
  color: var(--danger);
}

.fs__rejected summary {
  cursor: pointer;
  color: var(--text-muted);
}

.fs__rejected ul {
  margin: 10px 0 0;
  padding-left: 18px;
  line-height: 1.7;
}
</style>
