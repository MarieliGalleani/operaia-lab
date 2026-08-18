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
  <section class="delivery panel">
    <header class="delivery__head">
      <p class="eyebrow">{{ completed ? "Entrega pronta" : "Entrega" }}</p>
      <h2>{{ completed ? "Resultado do escritório" : "Ainda em andamento" }}</h2>
    </header>

    <p v-if="mission.usableResult" class="delivery__result">
      {{ mission.usableResult }}
    </p>
    <p v-else class="delivery__pending">
      {{
        completed
          ? "A missão concluiu, mas não há usableResult neste response."
          : "A entrega aparece aqui quando a Opera consolidar o trabalho."
      }}
    </p>

    <div v-if="answer" class="delivery__answer">
      <article v-if="answer.summary" class="delivery__block">
        <h3>Resumo</h3>
        <p>{{ answer.summary }}</p>
      </article>
      <article v-if="answer.projects?.length" class="delivery__block">
        <h3>Projetos</h3>
        <ul>
          <li v-for="item in answer.projects" :key="item">{{ item }}</li>
        </ul>
      </article>
      <article v-if="answer.risks?.length" class="delivery__block">
        <h3>Riscos</h3>
        <ul>
          <li v-for="item in answer.risks" :key="item">{{ item }}</li>
        </ul>
      </article>
      <article v-if="answer.nextActions?.length" class="delivery__block">
        <h3>Próximas ações</h3>
        <ul>
          <li v-for="item in answer.nextActions" :key="item">{{ item }}</li>
        </ul>
      </article>
    </div>

    <div v-if="mission.specialists.length" class="delivery__people">
      <h3>Especialistas na entrega</h3>
      <div class="delivery__chips">
        <span
          v-for="(specialist, index) in mission.specialists"
          :key="specialist.employeeId ?? `${specialist.specialization}-${index}`"
          class="delivery__chip"
        >
          {{ specialistEmoji(specialist.employeeId, specialist.specialization) }}
          {{ specialistName(specialist.employeeId) }}
        </span>
      </div>
        <p
        v-for="(specialist, index) in mission.specialists"
        v-show="Boolean(specialist.summary)"
        :key="`sum-${specialist.employeeId ?? index}`"
        class="delivery__note"
      >
        {{ specialist.summary }}
      </p>
    </div>

    <div v-if="deliveryEvents.length" class="delivery__created">
      <h3>delivery_created</h3>
      <article
        v-for="event in deliveryEvents"
        :key="event.id"
        class="delivery__event"
      >
        <p>{{ event.message }}</p>
        <p v-for="line in evidenceLines(event)" :key="line" class="delivery__note">
          {{ line }}
        </p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.delivery {
  padding: 18px;
}

.delivery__head h2 {
  margin-top: 4px;
  font-size: var(--text-lg);
  font-weight: 700;
}

.delivery__result {
  margin-top: 14px;
  font-size: var(--text-md);
  line-height: 1.5;
  color: var(--text);
}

.delivery__pending {
  margin-top: 14px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.delivery__answer {
  margin-top: 16px;
}

.delivery__block {
  margin-top: 12px;
}

.delivery__block h3,
.delivery__people h3,
.delivery__created h3 {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-soft);
}

.delivery__block p,
.delivery__block li {
  margin-top: 6px;
  font-size: var(--text-sm);
  color: var(--text);
}

.delivery__block ul {
  margin: 0;
  padding-left: 18px;
}

.delivery__people,
.delivery__created {
  margin-top: 16px;
}

.delivery__chips {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8px;
}

.delivery__chip {
  margin-right: 8px;
  margin-bottom: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: var(--text-xs);
}

.delivery__note {
  margin-top: 8px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.delivery__event {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: var(--text-sm);
}
</style>
