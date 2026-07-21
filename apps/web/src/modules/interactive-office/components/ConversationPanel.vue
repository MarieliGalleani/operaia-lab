<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useInteractiveOffice } from "../composables/useInteractiveOffice";

const { messages, thinking, sendToCeo } = useInteractiveOffice();

const draft = ref("");
const list = ref<HTMLDivElement | null>(null);

async function submit(): Promise<void> {
  const question = draft.value;
  draft.value = "";
  await sendToCeo(question);
}

watch(
  () => messages.value.length,
  async () => {
    await nextTick();
    if (list.value) {
      list.value.scrollTop = list.value.scrollHeight;
    }
  },
);
</script>

<template>
  <div class="conv">
    <div ref="list" class="conv__list">
      <p v-if="messages.length === 0" class="conv__hint">
        Converse com a CEO sobre objetivos. Ela analisa, envolve os especialistas
        certos e devolve um relatório executivo — tudo acontece no escritório.
      </p>

      <div
        v-for="message in messages"
        :key="message.id"
        class="msg"
        :class="message.author === 'user' ? 'msg--user' : 'msg--ceo'"
      >
        <span class="msg__author">{{ message.authorName }}</span>
        <p class="msg__content">{{ message.content }}</p>

        <div v-if="message.answer" class="answer">
          <div class="answer__block">
            <span class="answer__label">Resumo</span>
            <p class="answer__text">{{ message.answer.summary }}</p>
          </div>
          <div v-if="message.answer.projects.length" class="answer__block">
            <span class="answer__label">Projetos</span>
            <ul class="answer__list">
              <li v-for="(item, i) in message.answer.projects" :key="i">{{ item }}</li>
            </ul>
          </div>
          <div v-if="message.answer.risks.length" class="answer__block">
            <span class="answer__label">Riscos</span>
            <ul class="answer__list">
              <li v-for="(item, i) in message.answer.risks" :key="i">{{ item }}</li>
            </ul>
          </div>
          <div v-if="message.answer.nextActions.length" class="answer__block">
            <span class="answer__label">Próximas ações</span>
            <ul class="answer__list">
              <li v-for="(item, i) in message.answer.nextActions" :key="i">{{ item }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div v-if="thinking" class="msg msg--ceo msg--typing">
        <span class="msg__author">CEO — Opera</span>
        <p class="msg__content"><span class="dots"><i /><i /><i /></span></p>
      </div>
    </div>

    <form class="conv__form" @submit.prevent="submit">
      <input
        v-model="draft"
        type="text"
        placeholder="O que vamos fazer hoje?"
        :disabled="thinking"
      />
      <button type="submit" :disabled="thinking || !draft.trim()">Enviar</button>
    </form>
  </div>
</template>

<style scoped>
.conv {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.conv__list {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.conv__hint {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

.msg {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  max-width: 92%;
}

.msg--user {
  margin-left: auto;
  background: #4f46e5;
  color: #fff;
}

.msg--ceo {
  background: #f1f5f9;
  color: #1e293b;
}

.msg__author {
  display: block;
  font-size: 10px;
  font-weight: 700;
  opacity: 0.7;
  margin-bottom: 3px;
}

.msg__content {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
}

.answer {
  margin-top: 8px;
}

.answer__block {
  margin-top: 6px;
}

.answer__label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6366f1;
}

.answer__text {
  margin: 2px 0 0;
  font-size: 12px;
}

.answer__list {
  margin: 2px 0 0;
  padding-left: 16px;
  font-size: 12px;
}

.answer__list li {
  margin-top: 2px;
}

.conv__form {
  display: flex;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
}

.conv__form input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 13px;
  margin-right: 8px;
}

.conv__form input:focus {
  outline: none;
  border-color: #6366f1;
}

.conv__form button {
  padding: 10px 16px;
  border: 0;
  border-radius: 10px;
  background: #4f46e5;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}

.conv__form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dots {
  display: inline-flex;
  align-items: center;
}

.dots i {
  width: 6px;
  height: 6px;
  margin-right: 4px;
  border-radius: 50%;
  background: #94a3b8;
  animation: dots 1s ease-in-out infinite;
}

.dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.dots i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes dots {
  0%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-3px);
  }
}
</style>
