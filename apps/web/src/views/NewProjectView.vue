<script setup lang="ts">
/**
 * Criar projeto (P1.14A / Parte F + P1.14B / Parte 7).
 * Nome, objetivo, contexto e restrições — todos os campos que o backend
 * realmente persiste hoje (migration aditiva de P1.14B). Nenhum valor
 * fictício: campos vazios ficam null, não texto de preenchimento.
 */
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useOffice } from "@/composables/useOffice";
import { createProjectsClient } from "@/data/adapters/projects-client";

const router = useRouter();
const { load, projects } = useOffice();
const client = createProjectsClient();

const name = ref("");
const objective = ref("");
const context = ref("");
const constraints = ref("");
const state = ref<"idle" | "saving" | "error">("idle");
const errorMessage = ref("");

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function submit(): Promise<void> {
  if (!name.value.trim()) {
    return;
  }
  state.value = "saving";
  errorMessage.value = "";
  try {
    const project = await client.create({
      name: name.value.trim(),
      objective: orNull(objective.value),
      context: orNull(context.value),
      constraints: orNull(constraints.value),
    });
    await load(true);
    // O id "publico" usado pelo Project Hub é um slug derivado do nome
    // (publicWorkspaceId no backend), não o UUID de Project — dívida
    // estrutural já documentada (P1.14B/Parte 16). Resolve pelo nome
    // recém-criado na lista recarregada em vez de assumir que o UUID
    // funciona como rota.
    const created = projects.value.find((p) => p.id === project.id) ??
      projects.value.find((p) => p.name === project.name);
    await router.push(`/app/floor/dev/workspaces/${created?.id ?? project.id}`);
  } catch (error) {
    console.log("[new-project] falha ao criar", error);
    state.value = "error";
    errorMessage.value = "Não foi possível criar o projeto agora. Tente de novo.";
  }
}
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <router-link to="/app/floor/dev/workspaces" class="back">← Workspaces</router-link>
        <h1 class="page__title">Novo projeto</h1>
      </div>
    </header>

    <div class="studio__stage">
      <form class="panel form" @submit.prevent="submit">
        <label for="project-name">Nome do projeto</label>
        <input
          id="project-name"
          v-model="name"
          type="text"
          placeholder="Ex: OdontoClinic"
          autocomplete="off"
          required
        />

        <label for="project-objective">Objetivo</label>
        <p class="form__desc">O que este projeto precisa alcançar?</p>
        <textarea
          id="project-objective"
          v-model="objective"
          rows="3"
          placeholder="Opcional"
        />

        <label for="project-context">Contexto</label>
        <p class="form__desc">Informações importantes para entender este projeto.</p>
        <textarea
          id="project-context"
          v-model="context"
          rows="4"
          placeholder="Opcional"
        />

        <label for="project-constraints">Restrições</label>
        <p class="form__desc">Limites, regras ou condições que devem ser respeitados.</p>
        <textarea
          id="project-constraints"
          v-model="constraints"
          rows="3"
          placeholder="Opcional"
        />

        <p v-if="state === 'error'" class="form__error" role="alert">
          {{ errorMessage }}
        </p>
        <button type="submit" class="btn btn--primary" :disabled="state === 'saving' || !name.trim()">
          {{ state === "saving" ? "Criando…" : "Criar projeto" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.form {
  max-width: 560px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.form label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-soft);
  text-transform: uppercase;
  margin-top: 16px;
  margin-bottom: 6px;
}
.form label:first-of-type {
  margin-top: 0;
}
.form__desc {
  margin: 0 0 6px;
  font-size: var(--text-xs);
  color: var(--text-soft);
}
.form input,
.form textarea {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-size: var(--text-md);
  font-family: inherit;
  resize: vertical;
}
.form__error {
  margin-top: 14px;
  font-size: var(--text-sm);
  color: var(--danger);
}
.form .btn {
  margin-top: 18px;
  align-self: flex-start;
}
</style>
