<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { createMissionsClient } from "@/data/adapters/missions-client";
import { useOffice } from "@/composables/useOffice";

const emit = defineEmits<{ closed: [] }>();

const { projects } = useOffice();
const router = useRouter();
const client = createMissionsClient();

const objective = ref("");
const workspaceId = ref("operaia-lab");
const submitting = ref(false);
const error = ref<string | null>(null);

const options = computed(() =>
  projects.value.map((project) => ({ id: project.id, name: project.name })),
);

const selectedWorkspace = computed(
  () =>
    options.value.find((item) => item.id === workspaceId.value)?.id ??
    options.value[0]?.id ??
    "operaia-lab",
);

async function submit(): Promise<void> {
  const text = objective.value.trim();
  const workspace = selectedWorkspace.value;
  if (!text || !workspace) {
    error.value = "Escreva o objetivo e escolha o workspace.";
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    const result = await client.create({
      workspaceId: workspace,
      objective: text,
    });
    console.log("[missions] criada", result.mission.id, result.created);
    emit("closed");
    await router.push(`/app/missions/${result.mission.id}`);
  } catch (cause) {
    console.log("[missions] falha ao criar", cause);
    error.value =
      cause instanceof Error ? cause.message : "Não foi possível enviar a missão.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="op-create">
    <header class="op-create__head">
      <div>
        <p class="op-eyebrow-sm">Pedido ao escritório</p>
        <h2>Nova missão</h2>
      </div>
      <button type="button" class="op-btn" @click="emit('closed')">Fechar</button>
    </header>

    <label class="op-field">
      <span>O que você quer que o escritório faça?</span>
      <textarea
        v-model="objective"
        class="op-textarea"
        rows="5"
        maxlength="4000"
        placeholder="Descreva o trabalho em linguagem natural. O objetivo vai para a Opera como COORDINATE."
      />
    </label>

    <label class="op-field">
      <span>Workspace</span>
      <select v-model="workspaceId" class="op-select">
        <option v-for="item in options" :key="item.id" :value="item.id">
          {{ item.name }}
        </option>
        <option v-if="options.length === 0" value="operaia-lab">operaia-lab</option>
      </select>
    </label>

    <p class="op-hint">
      Modo avançado: envia direto para a fila, sem passar pela triagem de risco nem
      pedir aprovação. Para o caminho normal, use
      <router-link to="/app/command/new" class="op-hint__link" @click="emit('closed')">Nova demanda</router-link>.
    </p>
    <p v-if="error" class="op-error-inline">{{ error }}</p>

    <div class="op-create__actions">
      <button type="button" class="op-btn op-btn--cta" :disabled="submitting" @click="submit">
        {{ submitting ? "Enviando…" : "Enviar missão" }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.op-create {
  padding: 20px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  margin-bottom: 20px;
}

.op-create__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.op-create__head h2 {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-field {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
}

.op-field span {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--op-muted-4);
  margin-bottom: 8px;
}

.op-textarea,
.op-select {
  width: 100%;
  background: var(--op-raise);
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  padding: 10px 12px;
  font-size: 13px;
  color: var(--op-ink-2);
  font-family: inherit;
}

.op-textarea {
  resize: vertical;
  min-height: 120px;
}

.op-textarea:focus,
.op-select:focus {
  outline: none;
  border-color: var(--op-cta);
}

.op-hint {
  font-size: 11.5px;
  color: var(--op-muted-4);
}

.op-hint__link {
  color: var(--op-cta);
  font-weight: 600;
  text-decoration: underline;
}

.op-error-inline {
  margin-top: 8px;
  font-size: 12px;
  color: var(--op-red);
}

.op-create__actions {
  margin-top: 16px;
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
</style>
