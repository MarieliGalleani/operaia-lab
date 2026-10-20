<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  dateBr,
  downloadTemplate,
  fetchImports,
  removeImport,
  uploadSalesFile,
  type BusinessImport,
} from "@/modules/business/business-api";

const imports = ref<readonly BusinessImport[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const uploading = ref(false);
const open = ref<string | null>(null);
const confirming = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    imports.value = await fetchImports();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Não deu para carregar as planilhas.";
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
    notice.value = `"${r.fileName}": ${r.rowsAccepted} venda(s) nova(s)` +
      (r.rowsDuplicated ? `, ${r.rowsDuplicated} repetida(s) ignorada(s)` : "") +
      (r.rowsRejected ? `, ${r.rowsRejected} recusada(s)` : "") + ".";
    await load();
    if (r.rowsRejected) open.value = r.id;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Não deu para enviar a planilha.";
  } finally {
    uploading.value = false;
  }
}

async function confirmRemove(item: BusinessImport): Promise<void> {
  if (confirming.value !== item.id) {
    confirming.value = item.id;
    return;
  }
  confirming.value = null;
  error.value = null;
  try {
    await removeImport(item.id);
    notice.value = `"${item.fileName}" e as ${item.salesStored} venda(s) dela foram apagadas.`;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Não deu para apagar agora.";
  }
}

function when(iso: string): string {
  const d = new Date(iso);
  return `${dateBr(iso)} às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>

<template>
  <div class="studio bimp">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">5º andar · Negócio</p>
        <h1 class="page__title">Planilhas de vendas</h1>
      </div>
      <div class="bimp__actions">
        <button type="button" class="btn btn--ghost" @click="downloadTemplate">Baixar modelo</button>
        <label class="btn btn--primary bimp__upload" :class="{ 'is-busy': uploading }">
          {{ uploading ? "Enviando…" : "Enviar planilha" }}
          <input type="file" accept=".csv,text/csv,.txt" class="sr-only" :disabled="uploading" @change="onFile" />
        </label>
      </div>
    </header>

    <div class="studio__stage">
      <p v-if="error" class="panel bimp__alert bimp__alert--danger" role="alert">{{ error }}</p>
      <p v-if="notice" class="panel bimp__alert bimp__alert--ok" role="status">{{ notice }}</p>

      <p class="bimp__muted bimp__intro">
        Cada envio fica guardado aqui. Mandar a mesma planilha de novo não duplica as vendas.
        Apagar um envio tira as vendas dele do painel.
      </p>

      <p v-if="loading && !imports.length" class="bimp__muted">Carregando…</p>
      <section v-else-if="!imports.length" class="panel bimp__empty">
        <h2 class="section__title">Nenhuma planilha enviada</h2>
        <p class="bimp__muted">Use <strong>Enviar planilha</strong> ou baixe o modelo para ver o formato.</p>
      </section>

      <ul v-else class="bimp__list" role="list">
        <li v-for="item in imports" :key="item.id" class="panel bimp__item">
          <div class="bimp__head">
            <div class="bimp__name">
              <p class="bimp__file">{{ item.fileName }}</p>
              <p class="bimp__muted">
                {{ when(item.createdAt) }}<template v-if="item.createdBy"> · por {{ item.createdBy }}</template>
                <template v-if="!item.hasCost"> · sem coluna de custo</template>
              </p>
            </div>
            <div class="bimp__stats">
              <span class="bimp__stat is-good"><strong>{{ item.rowsAccepted }}</strong> novas</span>
              <span v-if="item.rowsDuplicated" class="bimp__stat"><strong>{{ item.rowsDuplicated }}</strong> repetidas</span>
              <button
                v-if="item.rowsRejected"
                type="button"
                class="bimp__stat is-bad bimp__stat--btn"
                :aria-expanded="open === item.id"
                @click="open = open === item.id ? null : item.id"
              >
                <strong>{{ item.rowsRejected }}</strong> recusadas {{ open === item.id ? "▴" : "▾" }}
              </button>
            </div>
            <button
              type="button"
              class="btn btn--ghost bimp__delete"
              :class="{ 'is-confirm': confirming === item.id }"
              @click="confirmRemove(item)"
              @blur="confirming = null"
            >
              {{ confirming === item.id ? "Confirmar: apagar" : "Apagar" }}
            </button>
          </div>
          <div v-if="open === item.id && item.rejected.length" class="bimp__rejected">
            <p class="bimp__muted">Corrija estas linhas na planilha e envie de novo (as que já entraram não duplicam):</p>
            <table class="bimp__table">
              <thead><tr><th>Linha</th><th>Motivo</th></tr></thead>
              <tbody>
                <tr v-for="r in item.rejected" :key="r.lineNumber"><td>{{ r.lineNumber }}</td><td>{{ r.reason }}</td></tr>
              </tbody>
            </table>
            <p v-if="item.rowsRejected > item.rejected.length" class="bimp__muted">
              Mostrando as {{ item.rejected.length }} primeiras de {{ item.rowsRejected }}.
            </p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.bimp__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.bimp__upload {
  cursor: pointer;
}

.bimp__upload.is-busy {
  opacity: 0.7;
  cursor: progress;
}

.bimp__muted {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.bimp__intro {
  margin-bottom: 14px;
}

.bimp__alert,
.bimp__empty {
  padding: 14px 18px;
  margin-bottom: 14px;
}

.bimp__alert--ok {
  border-color: var(--success);
  background: var(--success-soft);
}

.bimp__alert--danger {
  border-color: var(--danger);
  background: var(--danger-soft);
}

.bimp__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.bimp__item {
  padding: 14px 18px;
}

.bimp__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.bimp__name {
  flex: 1 1 220px;
  min-width: 0;
}

.bimp__file {
  margin: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.bimp__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.bimp__stat {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.8rem;
  color: var(--text-muted);
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.bimp__stat strong {
  color: var(--text);
}

.bimp__stat.is-good strong {
  color: var(--success);
}

.bimp__stat.is-bad strong {
  color: var(--danger);
}

.bimp__stat--btn {
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
}

.bimp__delete.is-confirm {
  border-color: var(--danger);
  color: var(--danger);
}

.bimp__rejected {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.bimp__table {
  width: 100%;
  margin-top: 8px;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.bimp__table th,
.bimp__table td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.bimp__table td:first-child {
  width: 70px;
  font-variant-numeric: tabular-nums;
}
</style>
