<script setup lang="ts">
import { computed } from "vue";
import { useOffice } from "@/composables/useOffice";
import type { MissionDetailDTO, MissionEventDTO } from "@/data/mission-contracts";
import { presentationFor } from "@/data/presentation";
import type { Specialization } from "@/types/office";

const props = defineProps<{ mission: MissionDetailDTO }>();

const { employeeById } = useOffice();

const completed = computed(() => props.mission.status === "COMPLETED");

const reply = computed(() => props.mission.reply);
const answer = computed(() => reply.value?.answer);

const deliveryEvents = computed(() =>
  props.mission.events.filter((event) => event.type === "delivery_created"),
);

function evidenceLines(event: MissionEventDTO): readonly string[] {
  const payload = event.payload;
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const record = payload as Record<string, unknown>;
  const lines: string[] = [];
  if (typeof record.deliveryType === "string") {
    lines.push(`tipo: ${record.deliveryType}`);
  }
  if (typeof record.summary === "string") {
    lines.push(record.summary);
  }
  if (typeof record.employeeId === "string") {
    lines.push(`especialista: ${record.employeeId}`);
  }
  if (Array.isArray(record.evidence)) {
    lines.push(`${record.evidence.length} evidência(s)`);
  }
  return lines;
}

function specialistName(id?: string): string {
  if (!id) {
    return "Especialista";
  }
  return employeeById(id)?.name ?? id;
}

function specialistEmoji(id: string | undefined, specialization: string): string {
  const person = id ? employeeById(id) : undefined;
  if (person) {
    return person.emoji;
  }
  return presentationFor(specialization as Specialization).emoji;
}
</script>

<template>
  <section class="op-delivery">
    <header class="op-delivery__head">
      <p class="op-eyebrow-sm">{{ completed ? "Entrega pronta" : "Entrega" }}</p>
      <h2>{{ completed ? "Resultado do escritório" : "Ainda em andamento" }}</h2>
    </header>

    <p v-if="mission.usableResult" class="op-delivery__result">
      {{ mission.usableResult }}
    </p>
    <p v-else class="op-delivery__pending">
      {{
        completed
          ? "A missão concluiu, mas não há usableResult neste response."
          : "A entrega aparece aqui quando a Opera consolidar o trabalho."
      }}
    </p>

    <div v-if="answer" class="op-delivery__answer">
      <article v-if="answer.summary" class="op-delivery__block">
        <h3>Resumo</h3>
        <p>{{ answer.summary }}</p>
      </article>
      <article v-if="answer.projects?.length" class="op-delivery__block">
        <h3>Projetos</h3>
        <ul>
          <li v-for="item in answer.projects" :key="item">{{ item }}</li>
        </ul>
      </article>
      <article v-if="answer.risks?.length" class="op-delivery__block">
        <h3>Riscos</h3>
        <ul>
          <li v-for="item in answer.risks" :key="item">{{ item }}</li>
        </ul>
      </article>
      <article v-if="answer.nextActions?.length" class="op-delivery__block">
        <h3>Próximas ações</h3>
        <ul>
          <li v-for="item in answer.nextActions" :key="item">{{ item }}</li>
        </ul>
      </article>
    </div>

    <div v-if="mission.specialists.length" class="op-delivery__people">
      <h3>Especialistas na entrega</h3>
      <div class="op-delivery__chips">
        <span
          v-for="(specialist, index) in mission.specialists"
          :key="specialist.employeeId ?? `${specialist.specialization}-${index}`"
          class="op-delivery__chip"
        >
          {{ specialistEmoji(specialist.employeeId, specialist.specialization) }}
          {{ specialistName(specialist.employeeId) }}
        </span>
      </div>
        <p
        v-for="(specialist, index) in mission.specialists"
        v-show="Boolean(specialist.summary)"
        :key="`sum-${specialist.employeeId ?? index}`"
        class="op-delivery__note"
      >
        {{ specialist.summary }}
      </p>
    </div>

    <div v-if="deliveryEvents.length" class="op-delivery__created">
      <h3>delivery_created</h3>
      <article
        v-for="event in deliveryEvents"
        :key="event.id"
        class="op-delivery__event"
      >
        <p>{{ event.message }}</p>
        <p v-for="line in evidenceLines(event)" :key="line" class="op-delivery__note">
          {{ line }}
        </p>
      </article>
    </div>

    <router-link
      v-if="mission.workspaceId"
      :to="`/app/floor/dev/workspaces/${mission.workspaceId}`"
      class="op-delivery__back-to-project"
    >
      ← Voltar ao projeto
    </router-link>
  </section>
</template>

<style scoped>
.op-delivery {
  padding: 20px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-delivery__head h2 {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-delivery__result {
  margin-top: 14px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--op-ink-3);
}

.op-delivery__pending {
  margin-top: 14px;
  font-size: 13px;
  color: var(--op-muted-3);
}

.op-delivery__answer {
  margin-top: 16px;
}

.op-delivery__block {
  margin-top: 12px;
}

.op-delivery__block h3,
.op-delivery__people h3,
.op-delivery__created h3 {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--op-muted-5);
}

.op-delivery__block p,
.op-delivery__block li {
  margin-top: 6px;
  font-size: 13px;
  color: var(--op-ink-3);
}

.op-delivery__block ul {
  margin: 0;
  padding-left: 18px;
}

.op-delivery__people,
.op-delivery__created {
  margin-top: 16px;
}

.op-delivery__chips {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8px;
  gap: 8px;
}

.op-delivery__chip {
  padding: 6px 10px;
  border-radius: var(--op-radius-full);
  border: 1px solid var(--op-line);
  background: var(--op-raise);
  font-size: 12px;
  color: var(--op-ink-3);
}

.op-delivery__note {
  margin-top: 8px;
  font-size: 13px;
  color: var(--op-muted-3);
}

.op-delivery__event {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-line);
  background: var(--op-raise);
  font-size: 13px;
  color: var(--op-ink-3);
}

.op-delivery__back-to-project {
  display: inline-block;
  margin-top: 18px;
  font-size: 13px;
  font-weight: 600;
  color: var(--op-cta);
}
</style>
