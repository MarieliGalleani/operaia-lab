<script setup lang="ts">
/**
 * Conhecimento (P1.14B / Parte 12) — CRUD real de NOTE por projeto.
 * DOCUMENT/LINK existem no modelo mas não têm UI nesta rodada (sem
 * storage/upload — ver Parte 13, NÃO implementado).
 * Isolamento sempre por workspaceId (Parte 17) — nenhuma nota aparece
 * fora do projeto selecionado.
 */
import { computed, onMounted, ref, watch } from "vue";
import { useOffice } from "@/composables/useOffice";
import {
  createKnowledgeClient,
  type KnowledgeItemDto,
} from "@/data/adapters/knowledge-client";

const { projects, loaded, load } = useOffice();
const client = createKnowledgeClient();

const selectedWorkspaceId = ref("");
const notes = ref<readonly KnowledgeItemDto[]>([]);
const state = ref<"idle" | "loading" | "ready" | "error">("idle");

const newTitle = ref("");
const newContent = ref("");
const creating = ref(false);

const editingId = ref<string | null>(null);
const editTitle = ref("");
const editContent = ref("");

async function loadNotes(workspaceId: string): Promise<void> {
  if (!workspaceId) {
    notes.value = [];
    return;
  }
  state.value = "loading";
  try {
    notes.value = await client.listByWorkspace(workspaceId);
    state.value = "ready";
  } catch (error) {
    console.log("[knowledge] falha ao listar notas", error);
    state.value = "error";
  }
}

onMounted(async () => {
  if (!loaded.value) {
    await load();
  }
  if (projects.value.length > 0) {
    selectedWorkspaceId.value = projects.value[0]!.id;
  }
});

watch(selectedWorkspaceId, (id) => loadNotes(id));

async function createNote(): Promise<void> {
  if (!newTitle.value.trim() || !selectedWorkspaceId.value) {
    return;
  }
  creating.value = true;
  try {
    await client.create({
      workspaceId: selectedWorkspaceId.value,
      type: "NOTE",
      title: newTitle.value.trim(),
      content: newContent.value.trim() || null,
    });
    newTitle.value = "";
    newContent.value = "";
    await loadNotes(selectedWorkspaceId.value);
  } catch (error) {
    console.log("[knowledge] falha ao criar nota", error);
  } finally {
    creating.value = false;
  }
}

function startEdit(note: KnowledgeItemDto): void {
  editingId.value = note.id;
  editTitle.value = note.title;
  editContent.value = note.content ?? "";
}

function cancelEdit(): void {
  editingId.value = null;
}

async function saveEdit(id: string): Promise<void> {
  if (!editTitle.value.trim()) {
    return;
  }
  try {
    await client.update(id, {
      title: editTitle.value.trim(),
      content: editContent.value.trim() || null,
    });
    editingId.value = null;
    await loadNotes(selectedWorkspaceId.value);
  } catch (error) {
    console.log("[knowledge] falha ao editar nota", error);
  }
}

async function removeNote(id: string): Promise<void> {
  try {
    await client.remove(id);
    await loadNotes(selectedWorkspaceId.value);
  } catch (error) {
    console.log("[knowledge] falha ao remover nota", error);
  }
}

const selectedProjectName = computed(
  () => projects.value.find((p) => p.id === selectedWorkspaceId.value)?.name,
);
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Base de conhecimento</p>
        <h1 class="page__title">Conhecimento</h1>
      </div>
      <div class="topbar__right">
        <router-link to="/app/office/sala-ceo" class="btn btn--ghost">Perguntar à Opera</router-link>
      </div>
    </header>

    <div class="studio__stage">
      <section class="panel picker">
        <label for="knowledge-project">Projeto</label>
        <select id="knowledge-project" v-model="selectedWorkspaceId">
          <option v-if="projects.length === 0" value="">Nenhum projeto disponível</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </section>

      <section v-if="selectedWorkspaceId" class="panel notes">
        <header class="notes__head">
          <p class="eyebrow">Notas</p>
          <h2>Conhecimento de {{ selectedProjectName }}</h2>
        </header>

        <form class="notes__new" @submit.prevent="createNote">
          <input
            v-model="newTitle"
            type="text"
            placeholder="Título da nota"
            required
          />
          <textarea
            v-model="newContent"
            rows="3"
            placeholder="Conteúdo (opcional)"
          />
          <button type="submit" class="btn btn--primary" :disabled="creating || !newTitle.trim()">
            {{ creating ? "Salvando…" : "Criar nota" }}
          </button>
        </form>

        <p v-if="state === 'loading'" class="notes__state">Carregando…</p>
        <p v-else-if="state === 'error'" class="notes__state notes__state--error" role="alert">
          Não foi possível carregar as notas agora.
        </p>
        <p v-else-if="notes.length === 0" class="notes__empty">
          Nenhuma nota registrada para este projeto ainda.
        </p>

        <ul v-else class="notes__list">
          <li v-for="note in notes" :key="note.id" class="note">
            <template v-if="editingId === note.id">
              <input v-model="editTitle" type="text" />
              <textarea v-model="editContent" rows="3" />
              <div class="note__actions">
                <button type="button" class="btn btn--primary" @click="saveEdit(note.id)">Salvar</button>
                <button type="button" class="btn btn--ghost" @click="cancelEdit">Cancelar</button>
              </div>
            </template>
            <template v-else>
              <h3>{{ note.title }}</h3>
              <p v-if="note.content" class="note__content">{{ note.content }}</p>
              <div class="note__actions">
                <button type="button" class="btn btn--ghost" @click="startEdit(note)">Editar</button>
                <button type="button" class="btn btn--ghost note__delete" @click="removeNote(note.id)">Excluir</button>
              </div>
            </template>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.topbar__left {
  min-width: 200px;
  margin-right: 16px;
}

.topbar__right {
  display: flex;
  margin-left: auto;
}

.picker {
  padding: 16px 18px;
  display: flex;
  align-items: center;
}

.picker label {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-soft);
  margin-right: 12px;
}

.picker select {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-size: var(--text-sm);
  min-width: 220px;
}

.notes {
  margin-top: 12px;
  padding: 18px;
}

.notes__head h2 {
  margin-top: 4px;
  font-size: var(--text-lg);
  font-weight: 700;
}

.notes__new {
  margin-top: 16px;
  padding: 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
}

.notes__new input,
.notes__new textarea,
.note input,
.note textarea {
  padding: 9px 11px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: var(--text-sm);
  margin-bottom: 10px;
  resize: vertical;
}

.notes__new .btn {
  align-self: flex-start;
}

.notes__state,
.notes__empty {
  margin-top: 16px;
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.notes__state--error {
  color: var(--danger);
}

.notes__list {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
}

.note {
  padding: 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  margin-bottom: 10px;
}

.note h3 {
  font-size: var(--text-sm);
  font-weight: 700;
}

.note__content {
  margin-top: 6px;
  font-size: var(--text-sm);
  color: var(--text-muted);
  white-space: pre-wrap;
}

.note__actions {
  display: flex;
  margin-top: 10px;
}

.note__actions .btn {
  margin-right: 8px;
  font-size: var(--text-xs);
  padding: 6px 10px;
}

.note__delete {
  color: var(--danger);
}

@media (max-width: 900px) {
  .studio__topbar {
    flex-wrap: wrap;
  }
  .topbar__right {
    width: 100%;
    margin-left: 0;
    margin-top: 12px;
  }
  .picker {
    flex-wrap: wrap;
  }
  .picker select {
    width: 100%;
    margin-top: 8px;
  }
}
</style>
