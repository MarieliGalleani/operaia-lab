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
    await router.push(`/app/office/missions/${result.mission.id}`);
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
  <section class="create panel">
    <header class="create__head">
      <div>
        <p class="eyebrow">Pedido ao escritório</p>
        <h2>Nova missão</h2>
      </div>
      <button type="button" class="btn btn--ghost" @click="emit('closed')">Fechar</button>
    </header>

    <label class="field">
      <span>O que você quer que o escritório faça?</span>
      <textarea
        v-model="objective"
        rows="5"
        maxlength="4000"
        placeholder="Descreva o trabalho em linguagem natural. O objetivo vai para a Opera como COORDINATE."
      />
    </label>

    <label class="field">
      <span>Workspace</span>
      <select v-model="workspaceId">
        <option v-for="item in options" :key="item.id" :value="item.id">
          {{ item.name }}
        </option>
        <option v-if="options.length === 0" value="operaia-lab">operaia-lab</option>
      </select>
    </label>

    <p class="hint">
      Envio direto para POST /api/v1/missions. Sem classificação extra no frontend.
    </p>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="create__actions">
      <button
        type="button"
        class="btn btn--primary"
        :disabled="submitting"
        @click="submit"
      >
        {{ submitting ? "Enviando…" : "Enviar missão" }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.create {
  padding: 18px;
  margin-bottom: 20px;
}

.create__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.create__head h2 {
  margin-top: 4px;
  font-size: var(--text-lg);
}

.field {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
}

.field span {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-soft);
  margin-bottom: 8px;
}

.field textarea,
.field select {
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  padding: 12px 14px;
}

.field textarea {
  resize: vertical;
  min-height: 120px;
}

.hint {
  font-size: var(--text-xs);
  color: var(--text-soft);
}

.error {
  margin-top: 8px;
  font-size: var(--text-sm);
  color: var(--danger);
}

.create__actions {
  margin-top: 16px;
}
</style>
