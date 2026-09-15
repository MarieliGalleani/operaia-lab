<script setup lang="ts">
/**
 * Carteira de Clientes — cadastro direto (sem precisar passar por uma
 * campanha primeiro), financeiro real por cliente (setup/recorrência com
 * valor e data) e painel geral do andar (quantos ativos, quem tá parado,
 * MRR estimado). Single-tenant: só a administradora usa esta tela, cliente
 * nunca loga aqui.
 */
import { computed, onMounted, ref } from "vue";
import {
  createCrmClient,
  type ClientPaymentEntry,
  type ClientPaymentKind,
  type ClientSummary,
  type ClientsOverview,
} from "@/data/adapters/crm-client";
import { HttpError } from "@/data/adapters/http-client";

const crm = createCrmClient();

const clients = ref<readonly ClientSummary[]>([]);
const overview = ref<ClientsOverview | null>(null);
const loadState = ref<"idle" | "loading" | "ready" | "error">("idle");
const showInactive = ref(false);

const visibleClients = computed(() =>
  showInactive.value ? clients.value : clients.value.filter((c) => c.active),
);

async function loadAll(): Promise<void> {
  loadState.value = "loading";
  try {
    const [clientList, overviewData] = await Promise.all([
      crm.listClients(),
      crm.getClientsOverview(),
    ]);
    clients.value = clientList;
    overview.value = overviewData;
    loadState.value = "ready";
  } catch (error) {
    loadState.value = "error";
    console.log("[client-roster] falha ao carregar carteira", error);
  }
}

async function refreshOverview(): Promise<void> {
  try {
    overview.value = await crm.getClientsOverview();
  } catch (error) {
    console.log("[client-roster] falha ao atualizar painel geral", error);
  }
}

const showCreateForm = ref(false);
const newNiche = ref("");
const newName = ref("");
const newContactName = ref("");
const newContactEmail = ref("");
const newContactPhone = ref("");
const creating = ref(false);
const createError = ref<string | null>(null);

async function submitCreate(): Promise<void> {
  if (!newNiche.value.trim() || !newName.value.trim()) {
    createError.value = "Preencha ao menos o nicho e o nome do cliente.";
    return;
  }
  creating.value = true;
  createError.value = null;
  try {
    const created = await crm.createClient({
      nicheName: newNiche.value.trim(),
      name: newName.value.trim(),
      contactName: newContactName.value.trim() || undefined,
      contactEmail: newContactEmail.value.trim() || undefined,
      contactPhone: newContactPhone.value.trim() || undefined,
    });
    clients.value = [...clients.value, created].sort((a, b) => a.name.localeCompare(b.name));
    newNiche.value = "";
    newName.value = "";
    newContactName.value = "";
    newContactEmail.value = "";
    newContactPhone.value = "";
    showCreateForm.value = false;
    await refreshOverview();
  } catch (error) {
    createError.value =
      error instanceof HttpError && error.status === 409
        ? "Já existe um cliente com esse nome nesse nicho."
        : "Não foi possível cadastrar o cliente.";
  } finally {
    creating.value = false;
  }
}

const editingId = ref<string | null>(null);
const editName = ref("");
const editContactName = ref("");
const editContactEmail = ref("");
const editContactPhone = ref("");
const editSetupPaid = ref(false);
const editRecurringActive = ref(false);
const editActive = ref(true);
const savingEdit = ref(false);
const editError = ref<string | null>(null);

const payments = ref<readonly ClientPaymentEntry[]>([]);
const paymentsLoadState = ref<"idle" | "loading" | "ready" | "error">("idle");
const newPaymentKind = ref<ClientPaymentKind>("RECORRENTE");
const newPaymentAmount = ref("");
const newPaymentDate = ref(new Date().toISOString().slice(0, 10));
const newPaymentNote = ref("");
const savingPayment = ref(false);

function startEdit(client: ClientSummary): void {
  editingId.value = client.id;
  editName.value = client.name;
  editContactName.value = client.contactName ?? "";
  editContactEmail.value = client.contactEmail ?? "";
  editContactPhone.value = client.contactPhone ?? "";
  editSetupPaid.value = client.setupPaid;
  editRecurringActive.value = client.recurringActive;
  editActive.value = client.active;
  editError.value = null;
  payments.value = [];
  void loadPayments(client.id);
}

function cancelEdit(): void {
  editingId.value = null;
  payments.value = [];
}

async function saveEdit(): Promise<void> {
  if (!editingId.value) return;
  savingEdit.value = true;
  editError.value = null;
  try {
    const updated = await crm.updateClient(editingId.value, {
      name: editName.value.trim(),
      contactName: editContactName.value.trim() || null,
      contactEmail: editContactEmail.value.trim() || null,
      contactPhone: editContactPhone.value.trim() || null,
      setupPaid: editSetupPaid.value,
      recurringActive: editRecurringActive.value,
      active: editActive.value,
    });
    clients.value = clients.value.map((c) => (c.id === updated.id ? updated : c));
    await refreshOverview();
  } catch (error) {
    editError.value = "Não foi possível salvar as alterações.";
    console.log("[client-roster] falha ao salvar cliente", error);
  } finally {
    savingEdit.value = false;
  }
}

async function loadPayments(clientId: string): Promise<void> {
  paymentsLoadState.value = "loading";
  try {
    payments.value = await crm.listPayments(clientId);
    paymentsLoadState.value = "ready";
  } catch (error) {
    paymentsLoadState.value = "error";
    console.log("[client-roster] falha ao carregar financeiro", error);
  }
}

async function submitPayment(): Promise<void> {
  if (!editingId.value) return;
  const amount = Number(newPaymentAmount.value.replace(",", "."));
  if (Number.isNaN(amount) || amount <= 0) {
    editError.value = "Informe um valor válido pro pagamento.";
    return;
  }
  savingPayment.value = true;
  editError.value = null;
  try {
    const created = await crm.createPayment(editingId.value, {
      kind: newPaymentKind.value,
      amountBrl: amount,
      paidAt: new Date(newPaymentDate.value).toISOString(),
      note: newPaymentNote.value.trim() || undefined,
    });
    payments.value = [created, ...payments.value];
    newPaymentAmount.value = "";
    newPaymentNote.value = "";
    await refreshOverview();
  } catch (error) {
    editError.value = "Não foi possível lançar o pagamento.";
    console.log("[client-roster] falha ao lançar pagamento", error);
  } finally {
    savingPayment.value = false;
  }
}

async function removePayment(id: string): Promise<void> {
  try {
    await crm.deletePayment(id);
    payments.value = payments.value.filter((p) => p.id !== id);
    await refreshOverview();
  } catch (error) {
    console.log("[client-roster] falha ao remover pagamento", error);
  }
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** paidAt/period sao meia-noite UTC do dia escolhido — exibe em UTC pra nao
 * voltar um dia em fusos atras (ex: Brasil, UTC-3). */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  });
}

onMounted(() => {
  void loadAll();
});
</script>

<template>
  <div class="op-roster">
    <div v-if="overview" class="op-roster__cards">
      <div class="op-roster__card">
        <span>Clientes ativos</span>
        <strong>{{ overview.activeClients }}</strong>
      </div>
      <div class="op-roster__card">
        <span>Setup pendente</span>
        <strong :class="{ 'is-warning': overview.setupPendingCount > 0 }">{{ overview.setupPendingCount }}</strong>
      </div>
      <div class="op-roster__card">
        <span>Recorrência ativa</span>
        <strong>{{ overview.recurringActiveCount }}</strong>
      </div>
      <div class="op-roster__card">
        <span>MRR estimado</span>
        <strong>{{ formatBrl(overview.estimatedMrrBrl) }}</strong>
      </div>
    </div>

    <div v-if="overview && overview.staleClients.length > 0" class="op-roster__stale">
      <strong>Parados há um tempo:</strong>
      <span v-for="s in overview.staleClients" :key="s.clientId" class="op-roster__stale-chip">
        {{ s.clientName }} · {{ s.daysSinceActivity }}d
      </span>
    </div>

    <div class="op-roster__toolbar">
      <label class="op-roster__toggle">
        <input v-model="showInactive" type="checkbox" />
        mostrar encerrados
      </label>
      <button type="button" class="op-btn op-btn--cta" @click="showCreateForm = !showCreateForm">
        {{ showCreateForm ? "Cancelar" : "+ Novo cliente" }}
      </button>
    </div>

    <form v-if="showCreateForm" class="op-roster__create" @submit.prevent="submitCreate">
      <input v-model="newNiche" type="text" class="op-input" placeholder="Nicho (ex: Clínicas veterinárias)" />
      <input v-model="newName" type="text" class="op-input" placeholder="Nome do cliente" />
      <input v-model="newContactName" type="text" class="op-input" placeholder="Contato (nome, opcional)" />
      <input v-model="newContactEmail" type="text" class="op-input" placeholder="E-mail (opcional)" />
      <input v-model="newContactPhone" type="text" class="op-input" placeholder="Telefone (opcional)" />
      <button type="submit" class="op-btn op-btn--cta" :disabled="creating">Cadastrar</button>
      <p v-if="createError" class="op-error-inline">{{ createError }}</p>
    </form>

    <p v-if="loadState === 'loading'" class="op-metrics__empty">Carregando carteira…</p>
    <p v-else-if="visibleClients.length === 0" class="op-metrics__empty">
      Nenhum cliente {{ showInactive ? "" : "ativo " }}cadastrado ainda.
    </p>

    <table v-else class="op-roster__table">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Nicho</th>
          <th>Contato</th>
          <th>Setup</th>
          <th>Recorrência</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="client in visibleClients" :key="client.id">
          <tr class="op-roster__row" :class="{ 'is-inactive': !client.active }">
            <td>{{ client.name }}</td>
            <td>{{ client.nicheName }}</td>
            <td class="op-roster__contact">
              <span v-if="client.contactName">{{ client.contactName }}</span>
              <span v-if="client.contactEmail" class="op-roster__contact-sub">{{ client.contactEmail }}</span>
              <span v-if="!client.contactName && !client.contactEmail" class="op-roster__empty-cell">—</span>
            </td>
            <td>
              <span class="op-roster__pill" :class="client.setupPaid ? 'is-on' : 'is-off'">
                {{ client.setupPaid ? "pago" : "pendente" }}
              </span>
            </td>
            <td>
              <span class="op-roster__pill" :class="client.recurringActive ? 'is-on' : 'is-off'">
                {{ client.recurringActive ? "ativa" : "inativa" }}
              </span>
            </td>
            <td>
              <span class="op-roster__pill" :class="client.active ? 'is-on' : 'is-off'">
                {{ client.active ? "ativo" : "encerrado" }}
              </span>
            </td>
            <td>
              <button
                type="button"
                class="op-roster__edit-btn"
                @click="editingId === client.id ? cancelEdit() : startEdit(client)"
              >
                {{ editingId === client.id ? "fechar" : "editar" }}
              </button>
            </td>
          </tr>
          <tr v-if="editingId === client.id" class="op-roster__edit-row">
            <td colspan="7">
              <div class="op-roster__edit">
                <div class="op-roster__edit-fields">
                  <input v-model="editName" type="text" class="op-input" placeholder="Nome" />
                  <input v-model="editContactName" type="text" class="op-input" placeholder="Contato" />
                  <input v-model="editContactEmail" type="text" class="op-input" placeholder="E-mail" />
                  <input v-model="editContactPhone" type="text" class="op-input" placeholder="Telefone" />
                </div>
                <div class="op-roster__edit-flags">
                  <label><input v-model="editSetupPaid" type="checkbox" /> Setup pago</label>
                  <label><input v-model="editRecurringActive" type="checkbox" /> Recorrência ativa</label>
                  <label><input v-model="editActive" type="checkbox" /> Cliente ativo</label>
                  <button type="button" class="op-btn op-btn--cta" :disabled="savingEdit" @click="saveEdit">
                    Salvar
                  </button>
                </div>
                <p v-if="editError" class="op-error-inline">{{ editError }}</p>

                <div class="op-roster__financeiro">
                  <h5>Financeiro</h5>
                  <p v-if="paymentsLoadState === 'loading'" class="op-metrics__empty">Carregando…</p>
                  <table v-else-if="payments.length > 0" class="op-metrics__entries-table">
                    <tbody>
                      <tr v-for="p in payments" :key="p.id">
                        <td class="op-roster__pill" :class="p.kind === 'SETUP' ? 'is-setup' : 'is-recorrente'">
                          {{ p.kind === "SETUP" ? "Setup" : "Recorrência" }}
                        </td>
                        <td class="op-mono">{{ formatDate(p.paidAt) }}</td>
                        <td class="op-mono">{{ formatBrl(p.amountBrl) }}</td>
                        <td>{{ p.note }}</td>
                        <td>
                          <button type="button" class="op-metrics__remove" @click="removePayment(p.id)">
                            remover
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p v-else class="op-metrics__empty">Nenhum pagamento lançado ainda.</p>

                  <form class="op-roster__payment-form" @submit.prevent="submitPayment">
                    <select v-model="newPaymentKind" class="op-input">
                      <option value="SETUP">Setup</option>
                      <option value="RECORRENTE">Recorrência</option>
                    </select>
                    <input v-model="newPaymentDate" type="date" class="op-input" />
                    <input
                      v-model="newPaymentAmount"
                      type="text"
                      inputmode="decimal"
                      class="op-input"
                      placeholder="Valor (R$)"
                    />
                    <input v-model="newPaymentNote" type="text" class="op-input" placeholder="Nota (opcional)" />
                    <button type="submit" class="op-btn" :disabled="savingPayment">Lançar</button>
                  </form>
                </div>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.op-input {
  width: 100%;
  background: var(--op-raise);
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  padding: 10px 12px;
  font-size: 13px;
  color: var(--op-ink-2);
  font-family: inherit;
}

.op-input:focus {
  outline: none;
  border-color: var(--op-cta);
}

.op-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-raise);
  color: var(--op-ink-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.op-btn:hover:not(:disabled) {
  border-color: var(--op-bd-btn-h);
}

.op-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.op-btn--cta {
  background: var(--op-cta);
  border-color: var(--op-cta);
  color: #fff;
}

.op-btn--cta:hover:not(:disabled) {
  background: var(--op-cta-h);
}

.op-mono {
  font-family: var(--op-font-mono);
}

.op-error-inline {
  color: var(--op-red);
  font-size: 12px;
  margin-bottom: 10px;
}

.op-metrics__empty {
  font-size: 13px;
  color: var(--op-muted-3);
  padding: 12px 0;
}

.op-metrics__entries-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.op-metrics__entries-table td {
  padding: 6px 8px;
  color: var(--op-muted-3);
  border-bottom: 1px solid var(--op-line);
}

.op-metrics__remove {
  background: none;
  border: none;
  color: var(--op-muted-3);
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
}

.op-roster__cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.op-roster__card {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.op-roster__card span {
  font-size: 11px;
  color: var(--op-muted-3);
}

.op-roster__card strong {
  font-family: "IBM Plex Mono", monospace;
  font-size: 18px;
}

.op-roster__card strong.is-warning {
  color: var(--op-amber, #d97706);
}

.op-roster__stale {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--op-muted-3);
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  padding: 8px 14px;
  margin-bottom: 16px;
}

.op-roster__stale-chip {
  border: 1px solid var(--op-line);
  border-radius: 999px;
  padding: 2px 10px;
}

.op-roster__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.op-roster__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--op-muted-3);
  cursor: pointer;
}

.op-roster__create {
  display: grid;
  grid-template-columns: 1.2fr 1.2fr 1fr 1fr 1fr auto;
  gap: 8px;
  align-items: start;
  margin-bottom: 16px;
}

.op-roster__create .op-error-inline {
  grid-column: 1 / -1;
}

.op-roster__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.op-roster__table th {
  text-align: left;
  color: var(--op-muted-3);
  font-weight: 600;
  font-size: 11px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--op-line);
}

.op-roster__row td {
  padding: 10px;
  border-bottom: 1px solid var(--op-line);
}

.op-roster__row.is-inactive {
  opacity: 0.55;
}

.op-roster__contact {
  display: flex;
  flex-direction: column;
  font-size: 12px;
}

.op-roster__contact-sub {
  color: var(--op-muted-3);
  font-size: 11px;
}

.op-roster__empty-cell {
  color: var(--op-muted-3);
}

.op-roster__pill {
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  padding: 2px 10px;
  border: 1px solid var(--op-line);
  color: var(--op-muted-3);
}

.op-roster__pill.is-on {
  color: var(--op-green);
  border-color: var(--op-green);
}

.op-roster__pill.is-off {
  color: var(--op-muted-3);
}

.op-roster__pill.is-setup {
  color: var(--op-cta);
  border-color: var(--op-cta);
}

.op-roster__pill.is-recorrente {
  color: var(--op-green);
  border-color: var(--op-green);
}

.op-roster__edit-btn {
  background: none;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  padding: 4px 10px;
  font-size: 11px;
  color: var(--op-muted-3);
  cursor: pointer;
}

.op-roster__edit-row td {
  padding: 0;
  border-bottom: 1px solid var(--op-line);
}

.op-roster__edit {
  background: var(--op-raise);
  padding: 16px;
}

.op-roster__edit-fields {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}

.op-roster__edit-flags {
  display: flex;
  align-items: center;
  gap: 18px;
  font-size: 12px;
  color: var(--op-muted-3);
  margin-bottom: 8px;
}

.op-roster__edit-flags label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.op-roster__financeiro {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--op-line);
}

.op-roster__financeiro h5 {
  font-size: 12px;
  color: var(--op-muted-3);
  margin: 0 0 8px;
}

.op-roster__payment-form {
  display: grid;
  grid-template-columns: 140px 130px 120px 1fr auto;
  gap: 8px;
  margin-top: 10px;
}

@media (max-width: 1100px) {
  .op-roster__cards {
    grid-template-columns: 1fr 1fr;
  }

  .op-roster__create,
  .op-roster__edit-fields {
    grid-template-columns: 1fr 1fr;
  }

  .op-roster__payment-form {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
