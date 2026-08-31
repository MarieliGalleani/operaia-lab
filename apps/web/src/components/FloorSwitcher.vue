<script setup lang="ts">
/**
 * Seletor de andar — o andar atual vem SEMPRE da rota (nunca de estado
 * local), conforme decisão de produto da Fase 1. Trocar de andar navega
 * pro Command Center daquele andar.
 */
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

interface FloorOption {
  readonly id: "dev" | "automation";
  readonly label: string;
  readonly hint: string;
  readonly command: string;
}

const FLOORS: readonly FloorOption[] = [
  {
    id: "dev",
    label: "1º Andar",
    hint: "Desenvolvimento",
    command: "/app/floor/dev/command",
  },
  {
    id: "automation",
    label: "2º Andar",
    hint: "Automação",
    command: "/app/floor/automation/command",
  },
];

const route = useRoute();
const router = useRouter();
const open = ref(false);

const currentFloorId = computed<"dev" | "automation">(() =>
  route.path.startsWith("/app/floor/automation") ? "automation" : "dev",
);

const current = computed(
  () => FLOORS.find((floor) => floor.id === currentFloorId.value) ?? FLOORS[0]!,
);

function toggle(): void {
  open.value = !open.value;
}

function selectFloor(floor: FloorOption): void {
  open.value = false;
  if (floor.id === currentFloorId.value) {
    return;
  }
  void router.push(floor.command);
}
</script>

<template>
  <div class="floor-switcher">
    <button
      type="button"
      class="floor-switcher__trigger"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="floor-switcher__copy">
        <strong>{{ current.label }}</strong>
        <span>{{ current.hint }}</span>
      </span>
      <svg
        class="floor-switcher__chev"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div v-if="open" class="floor-switcher__menu" role="listbox">
      <button
        v-for="floor in FLOORS"
        :key="floor.id"
        type="button"
        class="floor-switcher__option"
        :class="{ 'floor-switcher__option--active': floor.id === currentFloorId }"
        role="option"
        :aria-selected="floor.id === currentFloorId"
        @click="selectFloor(floor)"
      >
        <strong>{{ floor.label }}</strong>
        <span>{{ floor.hint }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.floor-switcher {
  position: relative;
  margin: 0 8px 16px;
}

.floor-switcher__trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--violet-line);
  background:
    linear-gradient(165deg, rgba(139, 92, 246, 0.14), transparent 60%),
    var(--surface-2);
  color: var(--text);
  text-align: left;
}

.floor-switcher__trigger:hover {
  border-color: var(--brand-line);
}

.floor-switcher__copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.floor-switcher__copy strong {
  font-size: 12.5px;
  font-weight: 700;
}

.floor-switcher__copy span {
  margin-top: 1px;
  font-size: 11px;
  color: var(--text-muted);
}

.floor-switcher__chev {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-soft);
}

.floor-switcher__menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.floor-switcher__option {
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 9px 10px;
  border-radius: 8px;
  color: var(--text-muted);
  text-align: left;
}

.floor-switcher__option strong {
  font-size: 12.5px;
  color: var(--text);
}

.floor-switcher__option span {
  margin-top: 1px;
  font-size: 11px;
}

.floor-switcher__option:hover {
  background: var(--surface-hover);
}

.floor-switcher__option--active {
  background: var(--brand-soft);
}

.floor-switcher__option--active strong {
  color: var(--brand);
}
</style>
