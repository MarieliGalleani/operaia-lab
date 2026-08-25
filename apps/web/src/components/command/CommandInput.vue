<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  modelValue: string;
  disabled?: boolean;
  placeholder?: string;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  submit: [];
}>();

const area = ref<HTMLTextAreaElement | null>(null);

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!props.disabled && props.modelValue.trim()) {
      emit("submit");
    }
  }
}

defineExpose({ focus: () => area.value?.focus() });
</script>

<template>
  <label class="cmd">
    <span class="cmd__label">O que você precisa que o escritório faça?</span>
    <textarea
      ref="area"
      class="cmd__input"
      rows="5"
      :value="modelValue"
      :disabled="disabled"
      :placeholder="placeholder ?? 'Ex.: Quero automatizar o onboarding dos novos clientes da clínica X.'"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      @keydown="onKeydown"
    />
    <span class="cmd__hint">Enter envia · Shift+Enter quebra linha</span>
  </label>
</template>

<style scoped>
.cmd {
  display: block;
}
.cmd__label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}
.cmd__input {
  width: 100%;
  resize: vertical;
  min-height: 120px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  line-height: 1.5;
}
.cmd__input:focus {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.cmd__hint {
  display: block;
  margin-top: 8px;
  font-size: var(--text-xs);
  color: var(--text-soft);
}
</style>
