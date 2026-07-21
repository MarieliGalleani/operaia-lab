<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { MEETING_ROOM_ID } from "../config/office-config";
import { useInteractiveOffice } from "../composables/useInteractiveOffice";
import DepartmentRoom from "./DepartmentRoom.vue";
import EmployeeRoom from "./EmployeeRoom.vue";
import ExecutiveRoom from "./ExecutiveRoom.vue";
import MeetingRoom from "./MeetingRoom.vue";
import OfficeWorld from "./OfficeWorld.vue";
import TimelinePanel from "./TimelinePanel.vue";
import WorkspaceRoom from "./WorkspaceRoom.vue";

const { employees, workspaces, selection, loading } = useInteractiveOffice();

const now = ref(currentTime());
let clock: number | undefined;

function currentTime(): string {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const workingCount = computed(
  () => employees.value.filter((e) => e.hired && e.state !== "AVAILABLE").length,
);
const hiredCount = computed(() => employees.value.filter((e) => e.hired).length);

onMounted(() => {
  clock = window.setInterval(() => {
    now.value = currentTime();
  }, 1000);
});

onBeforeUnmount(() => {
  if (clock) {
    window.clearInterval(clock);
  }
});
</script>

<template>
  <div class="shell">
    <div class="shell__stage">
      <OfficeWorld />

      <div class="shell__hud">
        <div>
          <h1 class="shell__title">Escritório OperaIA.lab</h1>
          <p class="shell__sub">
            {{ workingCount }} em atividade · {{ hiredCount }} na equipe ·
            {{ workspaces.length }} projetos
          </p>
        </div>
        <span class="shell__live"><i class="shell__dot" /> Ao vivo · {{ now }}</span>
      </div>

      <p v-if="loading" class="shell__loading">Abrindo o escritório…</p>
    </div>

    <aside class="shell__dock">
      <div class="shell__panel card">
        <EmployeeRoom
          v-if="selection.kind === 'employee'"
          :employee-id="selection.id"
        />
        <WorkspaceRoom
          v-else-if="selection.kind === 'workspace'"
          :workspace-id="selection.id"
        />
        <MeetingRoom
          v-else-if="selection.kind === 'room' && selection.id === MEETING_ROOM_ID"
        />
        <DepartmentRoom
          v-else-if="selection.kind === 'room'"
          :room-id="selection.id"
        />
        <ExecutiveRoom v-else />
      </div>

      <div class="shell__activity card">
        <TimelinePanel />
      </div>
    </aside>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  height: 100%;
  min-height: 0;
}

.shell__stage {
  position: relative;
  min-width: 0;
}

.shell__hud {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  pointer-events: none;
}

.shell__title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #1e293b;
}

.shell__sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #64748b;
}

.shell__live {
  display: inline-flex;
  align-items: center;
  padding: 5px 11px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #16a34a;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
}

.shell__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #16a34a;
  margin-right: 6px;
  animation: shell-pulse 1.5s ease-in-out infinite;
}

.shell__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 14px;
}

.shell__dock {
  display: flex;
  flex-direction: column;
  padding: 14px 14px 14px 0;
  min-height: 0;
}

.shell__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  min-height: 0;
  overflow: hidden;
}

.shell__activity {
  margin-top: 12px;
  padding: 14px 16px;
  max-height: 34%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card {
  background: #fff;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

@keyframes shell-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@media (max-width: 980px) {
  .shell {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }

  .shell__dock {
    padding: 14px;
  }
}
</style>
