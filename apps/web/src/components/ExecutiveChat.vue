<script setup lang="ts">
import { nextTick, ref } from "vue";
import { officeService } from "@/data/office-container";
import type { ChatMessage } from "@/types/office";
import { formatTime, greeting } from "@/utils/format";

withDefaults(defineProps<{ showHeader?: boolean }>(), { showHeader: true });

const suggestions = [
  "Opera, como estão meus projetos?",
  "Quais são os riscos agora?",
  "O que a equipe está fazendo?",
];

const messages = ref<ChatMessage[]>([
  {
    id: "welcome",
    author: "ceo",
    authorName: "CEO — Opera",
    content:
      `${greeting()}, Marieli. Sou a Opera, sua CEO. Posso te dar um panorama ` +
      "executivo dos projetos, riscos e próximas ações. Como posso ajudar?",
    timestamp: new Date().toISOString(),
  },
]);

const draft = ref("");
const sending = ref(false);
const thread = ref<HTMLElement | null>(null);

async function scrollToEnd(): Promise<void> {
  await nextTick();
  const el = thread.value;
  if (el) {
    el.scrollTop = el.scrollHeight;
  }
}

async function send(text: string): Promise<void> {
  const question = text.trim();
  if (!question || sending.value) {
    return;
  }
  messages.value.push({
    id: `u-${Date.now()}`,
    author: "user",
    authorName: "Marieli",
    content: question,
    timestamp: new Date().toISOString(),
  });
  draft.value = "";
  sending.value = true;
  await scrollToEnd();

  const reply = await officeService.askCeo(question);
  messages.value.push(reply);
  sending.value = false;
  await scrollToEnd();
}
</script>

<template>
  <div class="chat card">
    <header v-if="showHeader" class="chat__head">
      <span class="chat__avatar">👩🏻‍💼</span>
      <div>
        <strong class="chat__name">CEO — Opera</strong>
        <div class="chat__role">Coordenação executiva • sempre disponível</div>
      </div>
      <span class="badge badge--dot badge--working chat__status">Online</span>
    </header>

    <div ref="thread" class="chat__thread">
      <div
        v-for="message in messages"
        :key="message.id"
        class="msg"
        :class="`msg--${message.author}`"
      >
        <div class="msg__bubble">
          <p class="msg__content">{{ message.content }}</p>
        </div>
        <span class="msg__meta">
          {{ message.authorName }} • {{ formatTime(message.timestamp) }}
        </span>
      </div>
      <div v-if="sending" class="msg msg--ceo">
        <div class="msg__bubble msg__bubble--typing">Opera está analisando…</div>
      </div>
    </div>

    <div class="chat__suggestions">
      <button
        v-for="item in suggestions"
        :key="item"
        class="chip"
        type="button"
        @click="send(item)"
      >
        {{ item }}
      </button>
    </div>

    <form class="chat__input" @submit.prevent="send(draft)">
      <input
        v-model="draft"
        type="text"
        placeholder="O que vamos fazer hoje?"
        :disabled="sending"
      />
      <button type="submit" :disabled="sending || !draft.trim()">Enviar</button>
    </form>
  </div>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 560px;
  overflow: hidden;
}

.chat__head {
  display: flex;
  align-items: center;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}

.chat__avatar {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--brand-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-right: 12px;
}

.chat__name {
  font-size: 15px;
}

.chat__role {
  font-size: 12px;
  color: var(--text-soft);
  margin-top: 2px;
}

.chat__status {
  margin-left: auto;
}

.chat__thread {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
  background: var(--surface-2);
}

.msg {
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}

.msg--user {
  align-items: flex-end;
}

.msg__bubble {
  max-width: 86%;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.msg--user .msg__bubble {
  background: var(--brand);
  border-color: var(--brand);
}

.msg--user .msg__content {
  color: #fff;
}

.msg__content {
  white-space: pre-line;
  font-size: 13.5px;
  color: var(--text);
  line-height: 1.5;
}

.msg__bubble--typing {
  color: var(--text-muted);
  font-style: italic;
  font-size: 13px;
}

.msg__meta {
  margin-top: 5px;
  font-size: 11px;
  color: var(--text-soft);
}

.chat__suggestions {
  display: flex;
  flex-wrap: wrap;
  padding: 10px 14px 0;
}

.chip {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  margin: 0 8px 8px 0;
  transition: all 0.15s;
}

.chip:hover {
  border-color: var(--brand);
  color: var(--brand);
}

.chat__input {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  border-top: 1px solid var(--border);
}

.chat__input input {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 11px 14px;
  font-size: 14px;
  outline: none;
  margin-right: 10px;
}

.chat__input input:focus {
  border-color: var(--brand);
}

.chat__input button {
  border: none;
  background: var(--brand);
  color: #fff;
  font-weight: 600;
  padding: 11px 18px;
  border-radius: 10px;
  transition: background 0.15s;
}

.chat__input button:hover:not(:disabled) {
  background: var(--brand-strong);
}

.chat__input button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
