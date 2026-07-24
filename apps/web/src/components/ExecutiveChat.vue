<script setup lang="ts">
import { nextTick, ref } from "vue";
import { officeService } from "@/data/office-container";
import type { ChatMessage } from "@/types/office";
import { formatTime, greeting } from "@/utils/format";

withDefaults(defineProps<{ showHeader?: boolean }>(), { showHeader: true });

const emit = defineEmits<{
  replied: [];
}>();

const suggestions = [
  "Quero implementar autenticação.",
  "O que merece atenção hoje?",
  "Como está a NEXO?",
];

const messages = ref<ChatMessage[]>([
  {
    id: "welcome",
    author: "ceo",
    authorName: "CEO — Opera",
    content:
      `${greeting()}, Marieli.\n\n` +
      "Estou aqui. Podemos alinhar prioridades, riscos ou o próximo passo da equipe.",
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

  try {
    const reply = await officeService.askCeo(question);
    messages.value.push(reply);
    emit("replied");
  } catch (error) {
    console.log("[sala-ceo] falha ao perguntar à Opera", error);
    messages.value.push({
      id: `err-${Date.now()}`,
      author: "ceo",
      authorName: "CEO — Opera",
      content:
        "Não consegui concluir a missão agora. Verifique a API e tente de novo — " +
        "estou pronta quando a conexão voltar.",
      timestamp: new Date().toISOString(),
    });
  } finally {
    sending.value = false;
    await scrollToEnd();
  }
}
</script>

<template>
  <div class="chat card">
    <header v-if="showHeader" class="chat__head">
      <span class="chat__avatar">👩🏻‍💼</span>
      <div>
        <strong class="chat__name">CEO — Opera</strong>
        <div class="chat__role">Coordenação executiva • responde direto ou aciona a equipe</div>
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
        <div class="msg__bubble msg__bubble--typing">Opera está decidindo o próximo passo…</div>
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
        placeholder="Fale com a Opera…"
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
  padding: 12px 4px 16px;
  border-bottom: 1px solid var(--border);
}

.chat__avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 12px;
}

.chat__name {
  font-size: var(--text-md);
  font-weight: 600;
}

.chat__role {
  font-size: var(--text-xs);
  color: var(--text-soft);
  margin-top: 2px;
}

.chat__status {
  margin-left: auto;
}

.chat__thread {
  flex: 1;
  overflow-y: auto;
  padding: 16px 4px;
}

.msg {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
  animation: rise-in 0.3s var(--ease) both;
}

.msg--user {
  align-items: flex-end;
}

.msg__bubble {
  max-width: 90%;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.msg--ceo .msg__bubble {
  border-top-left-radius: 4px;
}

.msg--user .msg__bubble {
  background: var(--brand);
  border-color: transparent;
  border-top-right-radius: 4px;
}

.msg--user .msg__content {
  color: #fff;
}

.msg__content {
  white-space: pre-line;
  font-size: var(--text-sm);
  color: var(--text);
  line-height: 1.55;
}

.msg__bubble--typing {
  color: var(--text-muted);
  font-style: italic;
}

.msg__meta {
  margin-top: 6px;
  font-size: var(--text-xs);
  color: var(--text-soft);
}

.chat__suggestions {
  display: flex;
  flex-wrap: wrap;
  padding: 8px 0 0;
}

.chip {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: 500;
  padding: 8px 12px;
  border-radius: var(--radius-full);
  margin: 0 8px 8px 0;
  transition: border-color 0.15s var(--ease), color 0.15s var(--ease),
    background 0.15s var(--ease);
}

.chip:hover {
  border-color: var(--brand-line);
  color: var(--text);
  background: var(--brand-soft);
}

.chat__input {
  display: flex;
  align-items: center;
  padding: 12px 0 0;
  border-top: 1px solid var(--border);
  margin-top: 4px;
}

.chat__input input {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 11px 14px;
  font-size: var(--text-sm);
  font-family: inherit;
  color: var(--text);
  outline: none;
  margin-right: 10px;
  background: var(--bg-elevated);
  transition: border-color 0.15s var(--ease);
}

.chat__input input::placeholder {
  color: var(--text-soft);
}

.chat__input input:focus {
  border-color: var(--brand-line);
}

.chat__input button {
  border: none;
  background: var(--brand);
  color: #fff;
  font-weight: 600;
  font-size: var(--text-sm);
  padding: 11px 16px;
  border-radius: var(--radius-sm);
  transition: background 0.15s var(--ease);
}

.chat__input button:hover:not(:disabled) {
  background: var(--brand-strong);
}

.chat__input button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>


