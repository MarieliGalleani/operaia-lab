<script setup lang="ts">
/**
 * Aba Equipe (P1.21 + P1.X-FIX). Maquete isometrica fiel ao handoff
 * aprovado (inalterada). Employee nao tem floorId no dominio
 * (confirmado) — mostra o roster inteiro em todo andar, rotulado
 * honestamente como tal.
 *
 * P1.X-FIX:
 * - REG-04: refresh real (office.load(true)), nao mais no-op.
 * - REG-07: estados loading/empty/error/success explicitos — antes uma
 *   falha em useOffice().load() deixava a tela presa em "Carregando…"
 *   pra sempre (ver useOffice.ts).
 * - REG-12: cards recuperam especialidade, atividade atual, projetos
 *   envolvidos e ultima acao (mesma informacao que EmployeeRoom.vue
 *   mostrava, so que na linguagem visual nova).
 * - REG-16: aria-label nos controles de zoom (so-icone).
 */
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { useOffice } from "@/composables/useOffice";

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
const office = useOffice();

async function load(force = false): Promise<void> {
  await office.load(force);
}

onMounted(() => {
  if (!office.loaded.value) {
    void load();
  }
});

async function refresh(): Promise<void> {
  await load(true);
}

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

function involvedProjects(employeeId: string): readonly string[] {
  return office.projects.value
    .filter((p) => p.teamIds.includes(employeeId))
    .map((p) => p.name);
}

const viewState = computed<"loading" | "error" | "empty" | "ready">(() => {
  if (office.loading.value && office.employees.value.length === 0) return "loading";
  if (office.error.value && office.employees.value.length === 0) return "error";
  if (office.employees.value.length === 0) return "empty";
  return "ready";
});
</script>

<template>
  <OperationalHeader
    :floor="floor"
    :scope-line="`${floor.name} · dados isolados`"
    title="Equipe alocada"
    lede="Quem deste andar está executando e quem está livre — a mesma equipe digital, ainda não segmentada por andar."
    :show-cta="false"
    :refreshing="office.loading.value && office.loaded.value"
    @refresh="refresh"
  />
  <div class="op-content">
    <p v-if="viewState === 'loading'" class="op-loading">Carregando equipe…</p>

    <div v-else-if="viewState === 'error'" class="op-error" role="alert">
      <p class="op-error__title">Não foi possível carregar a equipe</p>
      <p class="op-error__body">{{ office.error.value }}</p>
      <button type="button" class="op-btn-retry" @click="refresh">Tentar de novo</button>
    </div>

    <p v-else-if="viewState === 'empty'" class="op-empty-inline">
      Nenhum especialista registrado.
    </p>

    <template v-else>
      <div class="op-mockup">
        <div
          class="op-mockup__viewport"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        >
          <div class="op-mockup__scaler" :style="{ transform: `scale(${zoom})` }">
            <img src="/assets/office-floor.png" alt="Maquete do escritório" class="op-mockup__img" />
            <div
              v-for="(pos, index) in DESK_POSITIONS"
              :key="index"
              class="op-mockup__label"
              :style="{ top: pos.top, left: pos.left }"
            >
              {{ office.employees.value[index]?.name ?? "—" }}
            </div>
          </div>
        </div>
        <div class="op-mockup__zoom">
          <button type="button" class="op-zoom-btn" aria-label="Diminuir zoom" @click="zoomOut">−</button>
          <button type="button" class="op-zoom-btn" aria-label="Centralizar zoom" @click="zoomReset">⊙</button>
          <button type="button" class="op-zoom-btn" aria-label="Aumentar zoom" @click="zoomIn">+</button>
        </div>
      </div>

      <div class="op-team-grid">
        <router-link
          v-for="e in office.employees.value"
          :key="e.id"
          :to="`/app/floor/dev/team/${e.id}`"
          class="op-employee-card"
        >
          <div class="op-employee-card__head">
            <span class="op-avatar-circle" :class="`is-${e.status.toLowerCase()}`">{{ e.emoji }}</span>
            <div class="op-employee-card__id">
              <p class="op-employee-card__name">{{ e.name }}</p>
              <p class="op-employee-card__role">{{ e.role }}</p>
              <p class="op-employee-card__specialty">{{ e.specialtyLabel }}</p>
            </div>
          </div>
          <div class="op-employee-card__state">
            <span class="op-dot" :class="e.status === 'WORKING' ? 'is-on' : 'is-off'" />
            <span>{{ STATUS_LABEL[e.status] ?? e.status }}</span>
          </div>
          <p v-if="e.mission" class="op-employee-card__mission">{{ e.mission }}</p>
          <p v-else class="op-employee-card__mission is-empty">Atividade atual não disponível.</p>

          <div class="op-employee-card__projects">
            <span class="op-eyebrow-sm">Projetos envolvidos</span>
            <div v-if="involvedProjects(e.id).length > 0" class="op-chips">
              <span v-for="name in involvedProjects(e.id).slice(0, 4)" :key="name" class="op-chip">{{ name }}</span>
              <span v-if="involvedProjects(e.id).length > 4" class="op-chip is-more">+{{ involvedProjects(e.id).length - 4 }}</span>
            </div>
            <span v-else class="op-employee-card__none">Nenhum no momento</span>
          </div>

          <p v-if="e.lastActivity" class="op-employee-card__last">
            <span class="op-eyebrow-sm">Última ação</span> {{ e.lastActivity }}
          </p>
        </router-link>
      </div>
    </template>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
}

.op-loading,
.op-empty-inline {
  color: var(--op-muted-4);
  font-size: 13px;
}

.op-error {
  max-width: 480px;
  padding: 24px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.op-error__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--op-ink-2);
  margin-bottom: 6px;
}

.op-error__body {
  font-size: 12.5px;
  color: var(--op-muted-3);
  margin-bottom: 14px;
}

.op-btn-retry {
  padding: 8px 14px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-raise);
  color: var(--op-ink-2);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.op-btn-retry:hover {
  border-color: var(--op-bd-btn-h);
}

.op-mono {
  font-family: var(--op-font-mono);
}

.op-mockup {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  margin-bottom: 20px;
}

.op-mockup__viewport {
  width: 100%;
  aspect-ratio: 16 / 8;
  overflow: hidden;
  position: relative;
  touch-action: none;
}

.op-mockup__scaler {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: center center;
  transition: transform 0.08s ease-out;
}

.op-mockup__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.op-mockup__label {
  position: absolute;
  transform: translate(-50%, -100%);
  background: var(--op-panel);
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-xs);
  padding: 3px 8px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--op-ink-3);
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.op-mockup__zoom {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  gap: 4px;
}

.op-zoom-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-bd-btn);
  background: var(--op-panel);
  color: var(--op-ink-3);
  cursor: pointer;
  font-size: 14px;
}

.op-zoom-btn:hover {
  border-color: var(--op-bd-btn-h);
}

.op-zoom-btn:focus-visible,
.op-btn-retry:focus-visible {
  outline: 2px solid var(--op-cta);
  outline-offset: 2px;
}

.op-team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.op-employee-card {
  display: block;
  padding: 14px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.op-employee-card:hover {
  border-color: var(--op-line-strong);
  background: var(--op-hover);
}

.op-employee-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.op-avatar-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--op-raise);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  border: 2px solid var(--op-muted-5);
}

.op-avatar-circle.is-working {
  border-color: var(--op-blue);
}
.op-avatar-circle.is-available {
  border-color: var(--op-green);
}
.op-avatar-circle.is-hiring {
  border-color: var(--op-muted-5);
  opacity: 0.6;
}

.op-employee-card__id {
  min-width: 0;
}

.op-employee-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-employee-card__role {
  font-size: 11px;
  color: var(--op-muted-4);
}

.op-employee-card__specialty {
  font-size: 10.5px;
  color: var(--op-muted-5);
}

.op-employee-card__state {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--op-muted-2);
  margin-bottom: 8px;
}

.op-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--op-radius-full);
}

.op-dot.is-on {
  background: var(--op-green);
}

.op-dot.is-off {
  background: var(--op-muted-5);
}

.op-employee-card__mission {
  font-size: 12px;
  line-height: 1.5;
  color: var(--op-muted-2);
  margin-bottom: 10px;
}

.op-employee-card__mission.is-empty {
  color: var(--op-muted-5);
  font-style: italic;
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-employee-card__projects {
  margin-bottom: 8px;
}

.op-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}

.op-chip {
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: var(--op-radius-full);
  background: var(--op-raise);
  color: var(--op-muted-2);
}

.op-chip.is-more {
  color: var(--op-muted-5);
}

.op-employee-card__none {
  display: block;
  margin-top: 5px;
  font-size: 11.5px;
  color: var(--op-muted-5);
}

.op-employee-card__last {
  font-size: 11.5px;
  color: var(--op-muted-3);
}
</style>
