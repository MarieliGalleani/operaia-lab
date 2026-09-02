<script setup lang="ts">
/**
 * Aba Equipe (P1.19). Employee nao tem floorId/workspaceGroup no
 * dominio (confirmado: zero ocorrencia em employees.application.ts) —
 * por isso mostra o roster inteiro, rotulado honestamente como "todos
 * os andares", em vez de fingir uma segmentacao que nao existe.
 *
 * A maquete e as 9 posicoes fixas SAO fieis ao design: no handoff elas
 * ja sao mapeadas por indice do array de equipe, sem depender de dado
 * de floor nenhum — reaproveitavel sem gap.
 */
import { ref } from "vue";
import type { Employee } from "@/types/office";

defineProps<{
  employees: readonly Employee[];
  loading: boolean;
}>();

const DESK_POSITIONS = [
  { top: "28%", left: "22%" },
  { top: "24%", left: "46%" },
  { top: "30%", left: "70%" },
  { top: "48%", left: "15%" },
  { top: "50%", left: "38%" },
  { top: "46%", left: "62%" },
  { top: "68%", left: "24%" },
  { top: "72%", left: "50%" },
  { top: "66%", left: "76%" },
] as const;

const zoom = ref(1);
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.15;

function zoomIn(): void {
  zoom.value = Math.min(ZOOM_MAX, Math.round((zoom.value + ZOOM_STEP) * 100) / 100);
}
function zoomOut(): void {
  zoom.value = Math.max(ZOOM_MIN, Math.round((zoom.value - ZOOM_STEP) * 100) / 100);
}
function zoomReset(): void {
  zoom.value = 1;
}

let pinchStartDistance = 0;
let pinchStartZoom = 1;

function touchDistance(touches: TouchList): number {
  const [a, b] = [touches[0]!, touches[1]!];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function onTouchStart(event: TouchEvent): void {
  if (event.touches.length === 2) {
    pinchStartDistance = touchDistance(event.touches);
    pinchStartZoom = zoom.value;
  }
}

function onTouchMove(event: TouchEvent): void {
  if (event.touches.length === 2 && pinchStartDistance > 0) {
    event.preventDefault();
    const ratio = touchDistance(event.touches) / pinchStartDistance;
    zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchStartZoom * ratio));
  }
}

function onTouchEnd(): void {
  pinchStartDistance = 0;
}

const STATUS_LABEL: Record<string, string> = {
  WORKING: "Trabalhando",
  AVAILABLE: "Disponível",
  HIRING: "Vaga aberta",
};
</script>

<template>
  <div class="oo-team">
    <p v-if="loading && employees.length === 0" class="oo-loading">Carregando equipe…</p>
    <template v-else>
      <p class="oo-team__note">
        Mostrando todos os andares — o domínio ainda não modela em qual andar cada
        especialista atua.
      </p>

      <section class="oo-card oo-mockup">
        <div
          class="oo-mockup__viewport"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        >
          <div class="oo-mockup__scaler" :style="{ transform: `scale(${zoom})` }">
            <img src="/assets/office-floor.png" alt="Maquete do escritório" class="oo-mockup__img" />
            <div
              v-for="(pos, index) in DESK_POSITIONS"
              :key="index"
              class="oo-mockup__label"
              :style="{ top: pos.top, left: pos.left }"
            >
              {{ employees[index]?.name ?? "—" }}
            </div>
          </div>
        </div>
        <div class="oo-mockup__zoom">
          <button type="button" class="oo-zoom-btn" @click="zoomOut">−</button>
          <button type="button" class="oo-zoom-btn" @click="zoomReset">⊙</button>
          <button type="button" class="oo-zoom-btn" @click="zoomIn">+</button>
        </div>
      </section>

      <div class="oo-team__grid">
        <div v-for="e in employees" :key="e.id" class="oo-card oo-employee-card oo-rise">
          <div class="oo-employee-card__head">
            <span class="oo-avatar-circle" :class="`is-${e.status.toLowerCase()}`">{{ e.emoji }}</span>
            <div>
              <p class="oo-employee-card__name">{{ e.name }}</p>
              <p class="oo-employee-card__role">{{ e.role }}</p>
            </div>
          </div>
          <div class="oo-employee-card__state">
            <span class="oo-dot" :class="e.status === 'WORKING' ? 'oo-dot--ok' : 'oo-dot--off'" />
            <span>{{ STATUS_LABEL[e.status] ?? e.status }}</span>
            <span v-if="e.mission" class="oo-employee-card__mission"> · {{ e.mission }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.oo-loading {
  color: var(--text-soft);
  font-size: 13px;
}

.oo-team__note {
  font-size: 12px;
  color: var(--text-soft);
  margin-bottom: 14px;
}

.oo-mockup {
  position: relative;
  padding: 0;
  overflow: hidden;
  margin-bottom: 16px;
}

.oo-mockup__viewport {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  position: relative;
  touch-action: none;
}

.oo-mockup__scaler {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: center center;
  transition: transform 0.08s ease-out;
}

.oo-mockup__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.oo-mockup__label {
  position: absolute;
  transform: translate(-50%, -100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 10.5px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.oo-mockup__zoom {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  gap: 4px;
}

.oo-zoom-btn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
}

.oo-team__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.oo-employee-card {
  padding: 14px;
}

.oo-employee-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.oo-avatar-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  border: 2px solid var(--text-soft);
}

.oo-avatar-circle.is-working {
  border-color: var(--info);
}
.oo-avatar-circle.is-available {
  border-color: var(--success);
}
.oo-avatar-circle.is-hiring {
  border-color: var(--text-soft);
  opacity: 0.6;
}

.oo-employee-card__name {
  font-size: 13px;
  font-weight: 600;
}

.oo-employee-card__role {
  font-size: 11px;
  color: var(--text-soft);
}

.oo-employee-card__state {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.oo-employee-card__mission {
  color: var(--text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
