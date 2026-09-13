<script setup lang="ts">
/**
 * Criar projeto (P1.14A / Parte F + P1.14B / Parte 7).
 * Nome, objetivo, contexto e restrições — todos os campos que o backend
 * realmente persiste hoje (migration aditiva de P1.14B). Nenhum valor
 * fictício: campos vazios ficam null, não texto de preenchimento.
 *
 * Fase 5 — O Mural do Escritório: migra pro sistema visual atual (--op-*).
 */
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { useOffice } from "@/composables/useOffice";
import { createProjectsClient } from "@/data/adapters/projects-client";

const route = useRoute();
const router = useRouter();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
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
  <OperationalHeader
    :floor="floor"
    scope-line="Trabalhos · Novo projeto"
    title="Novo projeto"
    lede="Nome, objetivo, contexto e restrições — só o que fica registrado de verdade."
    :show-cta="false"
    :show-refresh="false"
  />
  <div class="op-content">
    <form class="op-panel op-form" @submit.prevent="submit">
      <label class="op-field" for="project-name">
        <span>Nome do projeto</span>
        <input
          id="project-name"
          v-model="name"
          type="text"
          class="op-input"
          placeholder="Ex: OdontoClinic"
          autocomplete="off"
          required
        />
      </label>

      <label class="op-field" for="project-objective">
        <span>Objetivo</span>
        <p class="op-field__desc">O que este projeto precisa alcançar?</p>
        <textarea id="project-objective" v-model="objective" class="op-textarea" rows="3" placeholder="Opcional" />
      </label>

      <label class="op-field" for="project-context">
        <span>Contexto</span>
        <p class="op-field__desc">Informações importantes para entender este projeto.</p>
        <textarea id="project-context" v-model="context" class="op-textarea" rows="4" placeholder="Opcional" />
      </label>

      <label class="op-field" for="project-constraints">
        <span>Restrições</span>
        <p class="op-field__desc">Limites, regras ou condições que devem ser respeitados.</p>
        <textarea id="project-constraints" v-model="constraints" class="op-textarea" rows="3" placeholder="Opcional" />
      </label>

      <p v-if="state === 'error'" class="op-error-inline" role="alert">{{ errorMessage }}</p>
      <button type="submit" class="op-btn op-btn--cta" :disabled="state === 'saving' || !name.trim()">
        {{ state === "saving" ? "Criando…" : "Criar projeto" }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
}

.op-form {
  max-width: 560px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-field {
  display: flex;
  flex-direction: column;
  margin-top: 16px;
}

.op-field:first-of-type {
  margin-top: 0;
}

.op-field span {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--op-muted-4);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.op-field__desc {
  margin: 0 0 6px;
  font-size: 11.5px;
  color: var(--op-muted-4);
}

.op-input,
.op-textarea {
  padding: 10px 12px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-line);
  background: var(--op-raise);
  color: var(--op-ink-2);
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
}

.op-input:focus,
.op-textarea:focus {
  outline: none;
  border-color: var(--op-cta);
}

.op-error-inline {
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--op-red);
}

.op-btn {
  margin-top: 18px;
  align-self: flex-start;
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
</style>
