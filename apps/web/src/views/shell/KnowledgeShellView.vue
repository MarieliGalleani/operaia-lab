<script setup lang="ts">
/**
 * Base de conhecimento (Interface 3.0) — substitui a KnowledgeView antiga.
 *
 * As notas sao do PROJETO, nao da pessoa: todo especialista que pegar uma
 * demanda daquele projeto recebe as 3 notas mais relevantes junto com a
 * memoria das missoes anteriores (ver knowledge-notes.ts na API). Quem for
 * contratado amanha herda o mesmo conhecimento.
 *
 * Antes: erros ao salvar/editar/excluir iam so pro console e excluir nao
 * pedia confirmacao.
 */
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useOffice } from "@/composables/useOffice";
import { createKnowledgeClient, type KnowledgeItemDto } from "@/data/adapters/knowledge-client";

const { projects, loaded, load } = useOffice();
const client = createKnowledgeClient();
const route = useRoute();
const router = useRouter();

const selected = ref(String(route.query.workspace ?? ""));
const notes = ref<readonly KnowledgeItemDto[]>([]);
const state = ref<"idle" | "loading" | "ready" | "error">("idle");
const feedback = ref<{ ok: boolean; text: string } | null>(null);

const newTitle = ref("");
const newContent = ref("");
const creating = ref(false);
const editingId = ref<string | null>(null);
const editTitle = ref("");
const editContent = ref("");
const confirmDeleteId = ref<string | null>(null);
const busyId = ref<string | null>(null);

function fail(err: unknown, what: string): void {
  feedback.value = { ok: false, text: `${what}: ${err instanceof Error ? err.message : "erro de conexão"}` };
}

async function loadNotes(id: string): Promise<void> {
  if (!id) {
    notes.value = [];
    return;
  }
  state.value = "loading";
  try {
    notes.value = await client.listByWorkspace(id);
    state.value = "ready";
  } catch {
    state.value = "error";
  }
}

onMounted(async () => {
  if (!loaded.value) await load();
  if (!selected.value && projects.value.length > 0) {
    selected.value = projects.value.find((p) => p.id === "operaia-lab")?.id ?? projects.value[0]!.id;
  } else if (selected.value) {
    void loadNotes(selected.value);
  }
});

watch(selected, (id) => {
  feedback.value = null;
  editingId.value = null;
  confirmDeleteId.value = null;
  void router.replace({ query: { ...route.query, workspace: id } });
  void loadNotes(id);
});

const projectName = computed(() => projects.value.find((p) => p.id === selected.value)?.name ?? selected.value);
const sortedProjects = computed(() => [...projects.value].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));

async function createNote(): Promise<void> {
  if (!newTitle.value.trim() || !selected.value || creating.value) return;
  creating.value = true;
  feedback.value = null;
  try {
    await client.create({ workspaceId: selected.value, type: "NOTE", title: newTitle.value.trim(), content: newContent.value.trim() || null });
    newTitle.value = "";
    newContent.value = "";
    feedback.value = { ok: true, text: `Nota salva em ${projectName.value}. A equipe já recebe isso na próxima demanda deste projeto.` };
    await loadNotes(selected.value);
  } catch (err) {
    fail(err, "Não foi possível salvar a nota");
  } finally {
    creating.value = false;
  }
}

function startEdit(note: KnowledgeItemDto): void {
  editingId.value = note.id;
  editTitle.value = note.title;
  editContent.value = note.content ?? "";
  confirmDeleteId.value = null;
}

async function saveEdit(id: string): Promise<void> {
  if (!editTitle.value.trim()) return;
  busyId.value = id;
  feedback.value = null;
  try {
    await client.update(id, { title: editTitle.value.trim(), content: editContent.value.trim() || null });
    editingId.value = null;
    feedback.value = { ok: true, text: "Nota atualizada." };
    await loadNotes(selected.value);
  } catch (err) {
    fail(err, "Não foi possível atualizar");
  } finally {
    busyId.value = null;
  }
}

async function removeNote(id: string): Promise<void> {
  busyId.value = id;
  feedback.value = null;
  try {
    await client.remove(id);
    confirmDeleteId.value = null;
    feedback.value = { ok: true, text: "Nota excluída." };
    await loadNotes(selected.value);
  } catch (err) {
    fail(err, "Não foi possível excluir");
  } finally {
    busyId.value = null;
  }
}

function when(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
</script>

<template>
  <div class="kb">
    <header class="kb__head">
      <div class="kb__intro">
        <p class="kb__eyebrow">PRÉDIO · BASE DE CONHECIMENTO</p>
        <h1 class="kb__title">Conhecimento</h1>
        <p class="kb__lead">
          O que a equipe precisa saber sobre cada projeto. As notas são do projeto, não da pessoa: quem pegar a próxima
          demanda — inclusive alguém contratado amanhã — recebe tudo isso junto com a memória das missões anteriores.
        </p>
      </div>
      <router-link to="/app/portaria/sala-opera" class="kb__btn">Perguntar à Opera</router-link>
    </header>

    <div class="kb__grid">
      <section class="kb__card kb__new" aria-label="Nova nota">
        <label class="kb__label" for="kb-project">Projeto</label>
        <select id="kb-project" v-model="selected" class="kb__input">
          <option v-if="!projects.length" value="">Carregando projetos…</option>
          <option v-for="p in sortedProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>

        <form class="kb__form" @submit.prevent="createNote">
          <label class="kb__label" for="kb-title">Nova nota</label>
          <input id="kb-title" v-model="newTitle" class="kb__input" type="text" maxlength="200" placeholder="Título da nota" />
          <textarea v-model="newContent" class="kb__input" rows="5" maxlength="10000" placeholder="O que a equipe deve saber" />
          <button type="submit" class="kb__btn kb__btn--primary" :disabled="creating || !newTitle.trim() || !selected">
            {{ creating ? "Salvando…" : "Salvar nota" }}
          </button>
        </form>
        <p v-if="feedback" class="kb__feedback" :class="feedback.ok ? 'is-ok' : 'is-error'" role="status" aria-live="polite">
          {{ feedback.ok ? "✓ " : "" }}{{ feedback.text }}
        </p>
      </section>

      <section class="kb__card" :aria-label="`Notas de ${projectName}`">
        <p class="kb__eyebrow">NOTAS DE {{ projectName.toUpperCase() }} <span class="kb__count">{{ notes.length }}</span></p>
        <p v-if="state === 'loading'" class="kb__muted">Carregando…</p>
        <p v-else-if="state === 'error'" class="kb__feedback is-error" role="alert">
          Não foi possível carregar as notas agora.
          <button type="button" class="kb__link" @click="loadNotes(selected)">Tentar de novo</button>
        </p>
        <p v-else-if="!notes.length" class="kb__muted">Nenhuma nota para este projeto ainda. A primeira que você escrever já vai para a equipe.</p>

        <ul v-else class="kb__list">
          <li v-for="note in notes" :key="note.id" class="kb__note">
            <template v-if="editingId === note.id">
              <input v-model="editTitle" class="kb__input" type="text" maxlength="200" aria-label="Título" />
              <textarea v-model="editContent" class="kb__input" rows="5" maxlength="10000" aria-label="Conteúdo" />
              <div class="kb__actions">
                <button type="button" class="kb__btn kb__btn--primary kb__btn--sm" :disabled="busyId === note.id || !editTitle.trim()" @click="saveEdit(note.id)">
                  {{ busyId === note.id ? "Salvando…" : "Salvar" }}
                </button>
                <button type="button" class="kb__btn kb__btn--sm" @click="editingId = null">Cancelar</button>
              </div>
            </template>
            <template v-else>
              <h3 class="kb__note-title">{{ note.title }}</h3>
              <p v-if="note.content" class="kb__note-body">{{ note.content }}</p>
              <p class="kb__note-meta">Atualizada em {{ when(note.updatedAt ?? note.createdAt) }}</p>
              <div v-if="confirmDeleteId === note.id" class="kb__actions kb__confirm" role="group" aria-label="Confirmar exclusão">
                <span>Excluir esta nota? A equipe deixa de recebê-la.</span>
                <button type="button" class="kb__btn kb__btn--danger kb__btn--sm" :disabled="busyId === note.id" @click="removeNote(note.id)">
                  {{ busyId === note.id ? "Excluindo…" : "Sim, excluir" }}
                </button>
                <button type="button" class="kb__btn kb__btn--sm" @click="confirmDeleteId = null">Não</button>
              </div>
              <div v-else class="kb__actions">
                <button type="button" class="kb__btn kb__btn--sm" @click="startEdit(note)">Editar</button>
                <button type="button" class="kb__btn kb__btn--sm kb__btn--quiet" @click="confirmDeleteId = note.id">Excluir</button>
              </div>
            </template>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.kb {
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

.kb > * {
  flex-shrink: 0;
}

.kb__head {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-end;
  justify-content: space-between;
}

.kb__intro {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.kb__eyebrow,
.kb__label {
  margin: 0;
  font-family: var(--op-font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--op-muted-3);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.kb__title {
  margin: 0;
  font-size: 36px;
  line-height: 1.1;
  font-weight: 600;
  color: var(--op-ink);
}

.kb__lead {
  margin: 0;
  max-width: 720px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--op-muted-2);
}

.kb__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
  gap: 24px;
  align-items: start;
}

.kb__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  min-width: 0;
}

.kb__form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.kb__input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  background: transparent;
  color: var(--op-ink-3);
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
}

select.kb__input {
  background: var(--op-panel);
}

textarea.kb__input {
  resize: vertical;
}

.kb__input:focus {
  outline: none;
  border-color: var(--op-bd-sel);
}

.kb__btn {
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

.kb__btn:hover {
  border-color: var(--op-bd-btn-h);
}

.kb__btn--primary {
  border-color: transparent;
  background: var(--op-cta);
  color: #fff;
  font-weight: 600;
}

.kb__btn--primary:hover {
  background: var(--op-cta-h);
}

.kb__btn--danger {
  border-color: var(--op-red);
  color: var(--op-red);
}

.kb__btn--quiet {
  color: var(--op-muted-2);
}

.kb__btn--sm {
  min-height: 34px;
  padding: 0 12px;
  font-size: 13px;
}

.kb__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.kb__feedback {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--op-line-strong);
  border-radius: var(--op-radius-sm);
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.kb__feedback.is-ok {
  border-color: var(--op-green);
  color: var(--op-green);
}

.kb__feedback.is-error {
  border-color: var(--op-red);
  color: var(--op-red);
}

.kb__link {
  border: 0;
  background: none;
  color: var(--op-blue);
  font: inherit;
  cursor: pointer;
}

.kb__muted {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--op-muted-2);
}

.kb__count {
  margin-left: 6px;
  color: var(--op-ink-3);
}

.kb__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.kb__note {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 0;
  border-top: 1px solid var(--op-line-soft);
}

.kb__note:first-child {
  border-top: 0;
  padding-top: 4px;
}

.kb__note-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--op-ink);
  overflow-wrap: anywhere;
}

.kb__note-body {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--op-ink-3);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.kb__note-meta {
  margin: 0;
  font-family: var(--op-font-mono);
  font-size: 11px;
  color: var(--op-muted-3);
}

.kb__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.kb__confirm span {
  font-size: 13px;
  color: var(--op-red);
}

@media (max-width: 900px) {
  .kb__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .kb {
    padding-top: 20px;
  }

  .kb__title {
    font-size: 28px;
  }
}
</style>
