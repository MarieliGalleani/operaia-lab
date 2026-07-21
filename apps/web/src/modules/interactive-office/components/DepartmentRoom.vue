<script setup lang="ts">
import { computed } from "vue";
import { roomById } from "../config/office-config";
import { useInteractiveOffice } from "../composables/useInteractiveOffice";
import type { OfficeEmployee } from "../types";

const props = defineProps<{ roomId: string }>();

const { employees, workspaces, selectEmployee, selectWorkspace, openExecutive } =
  useInteractiveOffice();

const room = computed(() => roomById(props.roomId));

function inRoom(employee: OfficeEmployee): boolean {
  const r = room.value;
  if (!r) {
    return false;
  }
  const homeHere = employee.roomId === r.id;
  const visiting =
    employee.tile.col >= r.col &&
    employee.tile.col < r.col + r.w &&
    employee.tile.row >= r.row &&
    employee.tile.row < r.row + r.h;
  return homeHere || visiting;
}

const members = computed(() => employees.value.filter(inRoom));

const roomProjects = computed(() =>
  workspaces.value.filter((ws) =>
    ws.teamIds.some((id) => members.value.some((m) => m.id === id)),
  ),
);

const DESCRIPTION: Record<string, string> = {
  reception: "A porta de entrada do OperaIA.lab. Toda visita e novo objetivo começa aqui.",
  library: "Base de conhecimento da empresa: decisões, padrões e aprendizados.",
  lounge: "Espaço de descanso. Quando não há trabalho ativo, a equipe recarrega aqui.",
};
</script>

<template>
  <div v-if="room" class="dept">
    <button type="button" class="dept__back" @click="openExecutive">
      ← Sala Executiva
    </button>

    <header class="dept__head">
      <span class="dept__emoji">{{ room.emoji }}</span>
      <h2 class="dept__title">{{ room.label }}</h2>
    </header>

    <p v-if="DESCRIPTION[room.id]" class="dept__desc">{{ DESCRIPTION[room.id] }}</p>

    <section class="dept__section">
      <span class="dept__label">Quem está aqui</span>
      <div v-if="members.length" class="dept__people">
        <button
          v-for="member in members"
          :key="member.id"
          type="button"
          class="dept__person"
          @click="selectEmployee(member.id)"
        >
          <span class="dept__person-emoji">{{ member.emoji }}</span>
          <span class="dept__person-id">
            <span class="dept__person-role">{{ member.role }} — {{ member.name }}</span>
            <span class="dept__person-spec">{{ member.specialtyLabel }}</span>
          </span>
        </button>
      </div>
      <p v-else class="dept__muted">Sala vazia no momento.</p>
    </section>

    <section v-if="roomProjects.length" class="dept__section">
      <span class="dept__label">Projetos relacionados</span>
      <div class="dept__chips">
        <button
          v-for="ws in roomProjects"
          :key="ws.id"
          type="button"
          class="dept__chip"
          @click="selectWorkspace(ws.id)"
        >
          {{ ws.emoji }} {{ ws.name }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dept {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
}

.dept__back {
  align-self: flex-start;
  background: transparent;
  border: 0;
  color: #6366f1;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  padding: 0 0 8px;
}

.dept__head {
  display: flex;
  align-items: center;
}

.dept__emoji {
  font-size: 24px;
  margin-right: 9px;
}

.dept__title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #1e293b;
}

.dept__desc {
  margin: 8px 0 0;
  font-size: 13px;
  color: #475569;
  line-height: 1.45;
}

.dept__section {
  margin-top: 16px;
}

.dept__label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

.dept__people {
  display: flex;
  flex-direction: column;
  margin-top: 6px;
}

.dept__person {
  display: flex;
  align-items: center;
  padding: 7px 8px;
  margin-top: 5px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
}

.dept__person:hover {
  border-color: #6366f1;
}

.dept__person-emoji {
  font-size: 18px;
  margin-right: 9px;
}

.dept__person-id {
  display: flex;
  flex-direction: column;
}

.dept__person-role {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}

.dept__person-spec {
  font-size: 11px;
  color: #64748b;
}

.dept__muted {
  margin: 6px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.dept__chips {
  display: flex;
  flex-wrap: wrap;
  margin-top: 6px;
}

.dept__chip {
  margin: 4px 6px 0 0;
  padding: 5px 10px;
  background: #eef2ff;
  border: 0;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #4f46e5;
  cursor: pointer;
}
</style>
