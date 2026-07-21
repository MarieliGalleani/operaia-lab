<script setup lang="ts">
import { computed } from "vue";
import { useInteractiveOffice } from "../composables/useInteractiveOffice";

const { employees, ceo, selectEmployee, openExecutive } = useInteractiveOffice();

const inMeeting = computed(() =>
  employees.value.filter((e) => e.state === "MEETING"),
);
const active = computed(() => inMeeting.value.length > 0);

const participants = computed(() => {
  const list = [...inMeeting.value];
  if (active.value && ceo.value && !list.some((e) => e.id === ceo.value!.id)) {
    list.unshift(ceo.value);
  }
  return list;
});
</script>

<template>
  <div class="meet">
    <button type="button" class="meet__back" @click="openExecutive">
      ← Sala Executiva
    </button>

    <header class="meet__head">
      <span class="meet__emoji">🗣️</span>
      <h2 class="meet__title">Sala de Reuniões</h2>
    </header>

    <div class="meet__status" :class="{ 'meet__status--live': active }">
      <span class="meet__dot" />
      {{ active ? "Reunião em andamento" : "Nenhuma reunião agora" }}
    </div>

    <section v-if="active" class="meet__section">
      <span class="meet__label">Participantes</span>
      <div class="meet__people">
        <button
          v-for="member in participants"
          :key="member.id"
          type="button"
          class="meet__person"
          @click="selectEmployee(member.id)"
        >
          <span class="meet__person-emoji">{{ member.emoji }}</span>
          {{ member.role }} — {{ member.name }}
        </button>
      </div>
    </section>

    <p v-else class="meet__idle">
      As reuniões acontecem quando a CEO — Opera reúne especialistas para um
      briefing ou revisão. Converse com a Opera para colocar a equipe em ação.
    </p>
  </div>
</template>

<style scoped>
.meet {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
}

.meet__back {
  align-self: flex-start;
  background: transparent;
  border: 0;
  color: #6366f1;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  padding: 0 0 8px;
}

.meet__head {
  display: flex;
  align-items: center;
}

.meet__emoji {
  font-size: 24px;
  margin-right: 9px;
}

.meet__title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #1e293b;
}

.meet__status {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  margin-top: 12px;
  padding: 5px 11px;
  border-radius: 999px;
  background: #f1f5f9;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
}

.meet__status--live {
  background: #f3e8ff;
  color: #a855f7;
}

.meet__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  margin-right: 7px;
}

.meet__status--live .meet__dot {
  animation: meet-pulse 1.4s ease-in-out infinite;
}

.meet__section {
  margin-top: 16px;
}

.meet__label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

.meet__people {
  display: flex;
  flex-direction: column;
  margin-top: 6px;
}

.meet__person {
  display: flex;
  align-items: center;
  padding: 8px;
  margin-top: 5px;
  background: #faf5ff;
  border: 1px solid #f3e8ff;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  cursor: pointer;
  text-align: left;
}

.meet__person:hover {
  border-color: #a855f7;
}

.meet__person-emoji {
  font-size: 18px;
  margin-right: 9px;
}

.meet__idle {
  margin-top: 14px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

@keyframes meet-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
