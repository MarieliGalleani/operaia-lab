<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { GRID, ROOMS } from "../config/office-config";
import { drawOffice } from "../render/draw-office";
import {
  computeView,
  tileToScreen,
  type View,
} from "../render/projection";
import { useInteractiveOffice } from "../composables/useInteractiveOffice";
import type { OfficeEmployee, OfficeWorkspace, RoomDef } from "../types";
import EmployeeAvatar from "./EmployeeAvatar.vue";

const {
  employees,
  workspaces,
  selection,
  selectEmployee,
  selectWorkspace,
  selectRoom,
} = useInteractiveOffice();

const host = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const view = ref<View | null>(null);

let resizeObserver: ResizeObserver | undefined;

function render(): void {
  const el = host.value;
  const cv = canvas.value;
  if (!el) {
    return;
  }
  const cssW = Math.max(el.clientWidth, 1);
  const cssH = Math.max(el.clientHeight, 1);
  view.value = computeView(GRID.cols, GRID.rows, cssW, cssH);

  if (!cv) {
    return;
  }
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = cv.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) {
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);
  cv.style.width = `${cssW}px`;
  cv.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  drawOffice(ctx, view.value, employees.value);
}

function anchorStyle(employee: OfficeEmployee): Record<string, string> {
  if (!view.value) {
    return { display: "none" };
  }
  const p = tileToScreen(employee.tile.col, employee.tile.row, view.value);
  return {
    transform: `translate(${p.x}px, ${p.y}px)`,
    transition: `transform ${employee.moveMs}ms linear`,
  };
}

/** Salas de projeto ficam numa faixa comum ao sul do escritório. */
function markerStyle(index: number): Record<string, string> {
  if (!view.value) {
    return { display: "none" };
  }
  const col = 2 + (index % 3) * 6;
  const row = 14.4 + Math.floor(index / 3) * 1.4;
  const p = tileToScreen(col, row, view.value);
  return { transform: `translate(calc(${p.x}px - 50%), calc(${p.y}px - 50%))` };
}

function roomTagStyle(room: RoomDef): Record<string, string> {
  if (!view.value) {
    return { display: "none" };
  }
  const p = tileToScreen(room.col + room.w / 2 - 0.5, room.row - 0.4, view.value);
  return { transform: `translate(calc(${p.x}px - 50%), calc(${p.y}px - 50%))` };
}

function isRoomSelected(room: RoomDef): boolean {
  const sel = selection.value;
  if (room.kind === "executive") {
    return sel.kind === "executive";
  }
  return sel.kind === "room" && sel.id === room.id;
}

function isSelected(employee: OfficeEmployee): boolean {
  const sel = selection.value;
  if (employee.role === "CEO") {
    return sel.kind === "executive";
  }
  return sel.kind === "employee" && sel.id === employee.id;
}

function isWorkspaceSelected(workspace: OfficeWorkspace): boolean {
  return selection.value.kind === "workspace" && selection.value.id === workspace.id;
}

const workingCount = computed(
  () => employees.value.filter((e) => e.hired && e.state !== "AVAILABLE").length,
);

const rooms = ROOMS;

// redesenha o canvas (monitores acesos/apagados) quando os estados mudam
watch(
  () => employees.value.map((e) => `${e.state}:${e.moving ? 1 : 0}`).join("|"),
  () => render(),
);

onMounted(async () => {
  await nextTick();
  render();
  if (host.value && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => render());
    resizeObserver.observe(host.value);
  }
});

onBeforeUnmount(() => resizeObserver?.disconnect());

defineExpose({ workingCount });
</script>

<template>
  <div ref="host" class="office-map">
    <canvas ref="canvas" class="office-map__canvas" />
    <div class="office-map__overlay">
      <button
        v-for="room in rooms"
        :key="room.id"
        type="button"
        class="room-tag"
        :class="{ 'room-tag--selected': isRoomSelected(room) }"
        :style="roomTagStyle(room)"
        @click="selectRoom(room.id)"
      >
        <span class="room-tag__emoji">{{ room.emoji }}</span>{{ room.label }}
      </button>

      <button
        v-for="(workspace, index) in workspaces"
        :key="workspace.id"
        type="button"
        class="proj-marker"
        :class="{ 'proj-marker--selected': isWorkspaceSelected(workspace) }"
        :style="markerStyle(index)"
        @click="selectWorkspace(workspace.id)"
      >
        <span class="proj-marker__emoji">{{ workspace.emoji }}</span>
        {{ workspace.name }}
      </button>

      <div
        v-for="employee in employees"
        :key="employee.id"
        class="avatar-anchor"
        :style="anchorStyle(employee)"
      >
        <EmployeeAvatar
          :employee="employee"
          :selected="isSelected(employee)"
          @click="selectEmployee(employee.id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.office-map {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(circle at 50% 30%, #f8fafc 0%, #eef2f9 60%, #e2e8f0 100%);
}

.office-map__canvas {
  position: absolute;
  inset: 0;
}

.office-map__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.avatar-anchor {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  pointer-events: auto;
}

.proj-marker {
  position: absolute;
  left: 0;
  top: 0;
  display: inline-flex;
  align-items: center;
  padding: 5px 11px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.16);
  cursor: pointer;
  pointer-events: auto;
  transform-origin: center;
}

.proj-marker__emoji {
  margin-right: 5px;
}

.proj-marker:hover,
.proj-marker--selected {
  border-color: #6366f1;
  color: #4f46e5;
}

.room-tag {
  position: absolute;
  left: 0;
  top: 0;
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  white-space: nowrap;
  cursor: pointer;
  pointer-events: auto;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.room-tag__emoji {
  margin-right: 4px;
}

.room-tag:hover,
.room-tag--selected {
  background: #fff;
  border-color: #6366f1;
  color: #4f46e5;
}
</style>
