<script setup lang="ts">
/**
 * Escritorio 3D do andar (Interface 3.0).
 *
 * Um escritorio por andar: a planta vem de floors-3d.ts e o status de
 * cada especialista (trabalhando/livre) vem ao vivo do Command Center,
 * atualizado a cada 20 s. O elenco do Store Flow (Flow e Driele) ainda
 * nao tem status ao vivo — a tela diz isso em vez de inventar.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useAppTheme } from "@/composables/useAppTheme";
import { fetchLiveAgentStatus, type LiveAgentStatus } from "@/modules/office-domain/live-agent-status";
import {
  CAST,
  OFFICE_3D_FLOORS,
  floorCastIds,
  type CastMember,
  type Office3DFloorId,
} from "@/modules/office-3d/floors-3d";
import type { OfficeScene, PersonStatus } from "@/modules/office-3d/office-scene";

const props = defineProps<{ floorId: Office3DFloorId }>();

const BUILDING_TOTAL = Object.keys(CAST).length;
const POLL_MS = 20_000;

const { theme } = useAppTheme();
const canvasEl = ref<HTMLCanvasElement | null>(null);
const stageEl = ref<HTMLElement | null>(null);
const scene = shallowRef<OfficeScene | null>(null);
const failed = ref(false);
const live = ref<ReadonlyMap<string, LiveAgentStatus>>(new Map());
const liveLoaded = ref(false);
const selectedId = ref<string | null>(null);
const autoRotate = ref(false);
let poll: ReturnType<typeof setInterval> | null = null;
let observer: ResizeObserver | null = null;
let downAt: { x: number; y: number } | null = null;

const floor = computed(() => OFFICE_3D_FLOORS[props.floorId]);

interface RosterEntry {
  readonly member: CastMember;
  readonly busy: boolean;
  readonly objective: string | null;
}

const roster = computed<RosterEntry[]>(() =>
  floorCastIds(floor.value)
    .map((id) => CAST[id])
    .filter((m): m is CastMember => Boolean(m))
    .map((member) => {
      const status = live.value.get(member.id);
      return { member, busy: Boolean(status?.busy), objective: status?.objective ?? null };
    }),
);

const busyCount = computed(() => roster.value.filter((r) => r.busy).length);
const idleCount = computed(() => roster.value.length - busyCount.value);
const selected = computed(() => roster.value.find((r) => r.member.id === selectedId.value) ?? null);

const statuses = computed<PersonStatus[]>(() =>
  roster.value.map((r) => ({ id: r.member.id, state: r.busy ? "busy" : "idle" })),
);

function stateLabel(entry: RosterEntry): string {
  if (!entry.member.live) return "sem status ao vivo";
  return entry.busy ? "trabalhando" : "livre";
}

function nowText(entry: RosterEntry): string {
  if (!entry.member.live) return "O status ao vivo do Store Flow ainda não está ligado a esta tela.";
  if (entry.busy) return entry.objective ?? "Executando uma missão agora.";
  return "Livre agora. Quando chegar uma demanda para este andar, a mesa acende.";
}

async function refreshLive(): Promise<void> {
  live.value = await fetchLiveAgentStatus();
  liveLoaded.value = true;
}

function tagRef(id: string) {
  return (el: unknown) => {
    scene.value?.bindTag(id, (el as HTMLElement | null) ?? null);
  };
}

function onPointerDown(e: PointerEvent): void {
  downAt = { x: e.clientX, y: e.clientY };
}

function onPointerUp(e: PointerEvent): void {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
  const id = scene.value?.pick(e.clientX, e.clientY) ?? null;
  if (id) selectedId.value = id;
}

function toggleRotate(): void {
  autoRotate.value = !autoRotate.value;
  scene.value?.setAutoRotate(autoRotate.value);
}

function toggleFullscreen(): void {
  const el = stageEl.value;
  if (!el) return;
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  } catch {
    // tela cheia indisponivel (iframe, celular) — ignora.
  }
}

function resize(): void {
  const el = stageEl.value;
  if (el && scene.value) scene.value.resize(el.clientWidth, el.clientHeight);
}

onMounted(async () => {
  try {
    const { OfficeScene } = await import("@/modules/office-3d/office-scene");
    if (!canvasEl.value) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    scene.value = new OfficeScene(canvasEl.value, { theme: theme.value, reducedMotion: reduced });
    resize();
    scene.value.load(floor.value, statuses.value);
    await nextTick();
    // Etiquetas ja renderizadas antes da cena existir: liga agora.
    for (const r of roster.value) {
      const el = stageEl.value?.querySelector<HTMLElement>(`[data-tag="${r.member.id}"]`) ?? null;
      scene.value.bindTag(r.member.id, el);
    }
    observer = new ResizeObserver(resize);
    if (stageEl.value) observer.observe(stageEl.value);
  } catch (error) {
    console.log("[office-3d] falha ao iniciar a cena", error);
    failed.value = true;
  }
  await refreshLive();
  poll = setInterval(() => void refreshLive(), POLL_MS);
});

onBeforeUnmount(() => {
  if (poll) clearInterval(poll);
  observer?.disconnect();
  scene.value?.dispose();
  scene.value = null;
});

watch(statuses, (next) => scene.value?.updateStatus(next));
watch(theme, (next) => scene.value?.setTheme(next));
watch(
  () => props.floorId,
  async () => {
    selectedId.value = null;
    scene.value?.load(floor.value, statuses.value);
    await nextTick();
    for (const r of roster.value) {
      const el = stageEl.value?.querySelector<HTMLElement>(`[data-tag="${r.member.id}"]`) ?? null;
      scene.value?.bindTag(r.member.id, el);
    }
  },
);
</script>

<template>
  <div class="o3d">
    <section ref="stageEl" class="o3d__stage" :aria-label="`Escritório 3D — ${floor.title}`">
      <canvas
        ref="canvasEl"
        class="o3d__canvas"
        aria-label="Vista 3D do andar. Arraste para girar, role para aproximar, clique em alguém para ver o que está fazendo."
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
      />

      <div class="o3d__tags">
        <button
          v-for="r in roster"
          :key="r.member.id"
          :ref="tagRef(r.member.id)"
          :data-tag="r.member.id"
          type="button"
          class="o3d__tag"
          :class="{ 'is-busy': r.busy, 'is-off': !r.member.live }"
          :aria-label="`${r.member.name}, ${stateLabel(r)}`"
          @click="selectedId = r.member.id"
        >
          <b :style="{ background: r.member.color }" />
          <span>{{ r.member.name }}</span>
          <i />
        </button>
      </div>

      <header class="o3d__top">
        <div class="o3d__title-block">
          <h1 class="o3d__title">{{ floor.title }}</h1>
          <div class="o3d__pill">
            <span class="o3d__stack">
              <span
                v-for="r in roster"
                :key="r.member.id"
                class="o3d__av"
                :style="{ background: r.member.color }"
                :title="`${r.member.name} — ${stateLabel(r)}`"
              >
                {{ r.member.name.charAt(0) }}<i :class="{ 'is-busy': r.busy, 'is-off': !r.member.live }" />
              </span>
            </span>
            <span class="o3d__count">{{ roster.length }} NESTE ANDAR · {{ BUILDING_TOTAL }} NO PRÉDIO</span>
          </div>
        </div>
        <div class="o3d__tools">
          <button type="button" class="o3d__icon" aria-label="Recentralizar câmera" title="Recentralizar" @click="scene?.resetCamera()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></svg>
          </button>
          <button type="button" class="o3d__icon" :aria-pressed="autoRotate" aria-label="Girar automaticamente" title="Girar" @click="toggleRotate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v5h-5" /></svg>
          </button>
          <button type="button" class="o3d__icon" aria-label="Tela cheia" title="Tela cheia" @click="toggleFullscreen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          </button>
        </div>
      </header>

      <aside v-if="selected" class="o3d__card" aria-live="polite">
        <div class="o3d__card-head">
          <span class="o3d__card-av" :style="{ background: selected.member.color }" aria-hidden="true">{{ selected.member.name.charAt(0) }}</span>
          <div>
            <h2>{{ selected.member.name }}</h2>
            <p class="o3d__role">{{ selected.member.role }}</p>
          </div>
          <button type="button" class="o3d__close" aria-label="Fechar" @click="selectedId = null">×</button>
        </div>
        <p class="o3d__now">{{ nowText(selected) }}</p>
        <div class="o3d__meta">
          <span>{{ stateLabel(selected).toUpperCase() }}</span>
          <span>{{ floor.code === "T" ? "TÉRREO" : `ANDAR ${floor.code}` }}</span>
        </div>
      </aside>

      <footer class="o3d__bottom">
        <p class="o3d__status">
          <span class="is-ok">{{ busyCount }} trabalhando</span>
          <span aria-hidden="true">·</span>
          <span>{{ idleCount }} livres</span>
          <span aria-hidden="true">·</span>
          <span>{{ liveLoaded ? "status ao vivo" : "carregando status…" }}</span>
          <span aria-hidden="true">·</span>
          <span>arrastar · rolar · clicar</span>
        </p>
      </footer>

      <p v-if="failed" class="o3d__fallback">Não foi possível iniciar o 3D neste navegador.</p>
    </section>
  </div>
</template>

<style scoped>
.o3d {
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 16px;
  box-sizing: border-box;
}

.o3d__stage {
  position: relative;
  flex: 1;
  min-height: 480px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel-2);
  overflow: hidden;
}

.o3d__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
  touch-action: none;
}

.o3d__canvas:active {
  cursor: grabbing;
}

.o3d__tags {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.o3d__tag {
  position: absolute;
  left: -200px;
  top: -200px;
  transform: translate(-50%, -100%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 9px 4px 0;
  border: 1px solid var(--op-line-strong);
  border-radius: var(--op-radius-xs);
  background: color-mix(in srgb, var(--op-panel) 92%, transparent);
  color: var(--op-ink-3);
  font: 500 12px/1.2 "Sora", sans-serif;
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
}

.o3d__tag b {
  width: 3px;
  align-self: stretch;
  border-radius: 0 2px 2px 0;
}

.o3d__tag i,
.o3d__av i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--op-amber);
}

.o3d__tag.is-busy i,
.o3d__av i.is-busy {
  background: var(--op-green);
  box-shadow: 0 0 0 3px var(--op-halo);
}

.o3d__tag.is-off i,
.o3d__av i.is-off {
  background: var(--op-muted-4);
}

.o3d__top {
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-start;
  justify-content: center;
  pointer-events: none;
}

.o3d__top > * {
  pointer-events: auto;
}

.o3d__title-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.o3d__title {
  margin: 0;
  font-family: var(--op-font-mono);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.3em;
  color: var(--op-ink-2);
  text-align: center;
}

.o3d__pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 4px 4px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-full);
  background: var(--op-panel);
}

.o3d__stack {
  display: flex;
}

.o3d__av {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 600;
  color: #07090d;
  border: 2px solid var(--op-panel);
}

.o3d__av + .o3d__av {
  margin-left: -7px;
}

.o3d__av i {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 9px;
  height: 9px;
  border: 2px solid var(--op-panel);
}

.o3d__count {
  font-family: var(--op-font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--op-ink-4);
  border: 1px solid var(--op-bd-chip);
  border-radius: var(--op-radius-full);
  padding: 5px 10px;
  white-space: nowrap;
}

.o3d__tools {
  position: absolute;
  right: 0;
  top: 0;
  display: flex;
  gap: 6px;
}

.o3d__icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  background: var(--op-panel);
  color: var(--op-muted);
  cursor: pointer;
}

.o3d__icon:hover,
.o3d__icon[aria-pressed="true"] {
  color: var(--op-ink-2);
  border-color: var(--op-bd-btn-h);
}

.o3d__icon:focus-visible,
.o3d__tag:focus-visible,
.o3d__close:focus-visible {
  outline: 2px solid var(--op-cta);
  outline-offset: 2px;
}

.o3d__card {
  position: absolute;
  top: 96px;
  right: 14px;
  width: min(300px, calc(100% - 28px));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--op-line-strong);
  border-radius: var(--op-radius);
  background: color-mix(in srgb, var(--op-panel) 97%, transparent);
}

.o3d__card-head {
  display: flex;
  gap: 12px;
  align-items: center;
}

.o3d__card-av {
  width: 40px;
  height: 40px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #07090d;
  font-weight: 600;
}

.o3d__card h2 {
  margin: 0;
  font-size: 16px;
  color: var(--op-ink-2);
}

.o3d__role {
  margin: 0;
  font-size: 12px;
  color: var(--op-muted-2);
}

.o3d__close {
  margin-left: auto;
  width: 32px;
  height: 32px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  background: transparent;
  color: var(--op-muted);
  font-size: 16px;
  cursor: pointer;
}

.o3d__now {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--op-ink-5);
}

.o3d__meta {
  display: flex;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--op-line);
  font-family: var(--op-font-mono);
  font-size: 11px;
  color: var(--op-muted-2);
}

.o3d__bottom {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 14px;
  display: flex;
  pointer-events: none;
}

.o3d__status {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius-sm);
  background: var(--op-panel);
  font-family: var(--op-font-mono);
  font-size: 11px;
  color: var(--op-muted);
  pointer-events: auto;
}

.o3d__status .is-ok {
  color: var(--op-green);
}

.o3d__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: var(--op-muted);
  font-size: 14px;
}

@media (max-width: 720px) {
  .o3d {
    padding: 8px;
  }
  .o3d__tools {
    position: static;
  }
  .o3d__title {
    font-size: 12px;
    letter-spacing: 0.18em;
  }
}
</style>
