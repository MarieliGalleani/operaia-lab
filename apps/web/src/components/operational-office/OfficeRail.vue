<script setup lang="ts">
import { ref } from "vue";
import type { OfficeFloorDef } from "@/data/office-floors";
import type { OfficeTheme } from "@/composables/useOfficeTheme";

const props = defineProps<{
  floors: readonly OfficeFloorDef[];
  activeFloorId: string;
  activeTab: string;
  theme: OfficeTheme;
  supervisorRunning: boolean | null;
  supervisorCycle: number | null;
  userLogin: string | null;
}>();

const emit = defineEmits<{
  (e: "floor-change", id: string): void;
  (e: "tab-change", id: string): void;
  (e: "theme-toggle"): void;
  (e: "logout"): void;
}>();

const floorPickerOpen = ref(false);

function activeFloor(): OfficeFloorDef {
  return props.floors.find((f) => f.id === props.activeFloorId) ?? props.floors[0]!;
}

function selectFloor(id: string): void {
  emit("floor-change", id);
  floorPickerOpen.value = false;
}

const PRIMARY_TABS = [
  { id: "today", label: "Hoje" },
  { id: "work", label: "Trabalhos" },
  { id: "team", label: "Equipe" },
  { id: "signals", label: "Sinais" },
] as const;
</script>

<template>
  <aside class="oo-rail">
    <div class="oo-rail__top">
      <div class="oo-rail__brand">
        <span class="oo-rail__dot oo-pulse" />
        <span>Operaia.lab</span>
      </div>
      <div class="oo-rail__theme">
        <button
          type="button"
          class="oo-theme-btn"
          :class="{ 'is-active': theme === 'dark' }"
          title="Tema escuro"
          @click="emit('theme-toggle')"
        >
          🌙
        </button>
        <button
          type="button"
          class="oo-theme-btn"
          :class="{ 'is-active': theme === 'light' }"
          title="Tema claro"
          @click="emit('theme-toggle')"
        >
          ☀️
        </button>
      </div>
    </div>

    <div class="oo-rail__floor">
      <button
        v-if="!floorPickerOpen"
        type="button"
        class="oo-floor-collapsed"
        @click="floorPickerOpen = true"
      >
        <span class="oo-floor-badge">{{ activeFloor().code }}</span>
        <span class="oo-floor-name">{{ activeFloor().name }}</span>
        <span class="oo-floor-switch" title="Trocar andar">⇄</span>
      </button>
      <div v-else class="oo-floor-list">
        <button
          v-for="floor in floors"
          :key="floor.id"
          type="button"
          class="oo-floor-option"
          :class="{ 'is-active': floor.id === activeFloorId }"
          @click="selectFloor(floor.id)"
        >
          <span class="oo-floor-badge">{{ floor.code }}</span>
          <span>{{ floor.name }}</span>
        </button>
      </div>
    </div>

    <nav class="oo-rail__nav">
      <p class="oo-eyebrow oo-nav-group">{{ activeFloor().name }}</p>
      <button
        v-for="tab in PRIMARY_TABS"
        :key="tab.id"
        type="button"
        class="oo-nav-item"
        :class="{ 'is-active': activeTab === tab.id }"
        @click="emit('tab-change', tab.id)"
      >
        {{ tab.label }}
      </button>

      <p class="oo-eyebrow oo-nav-group oo-nav-group--building">Prédio</p>
      <button
        type="button"
        class="oo-nav-item"
        :class="{ 'is-active': activeTab === 'infra' }"
        @click="emit('tab-change', 'infra')"
      >
        Infraestrutura
      </button>
    </nav>

    <div class="oo-rail__supervisor">
      <span
        class="oo-dot"
        :class="supervisorRunning ? 'oo-dot--ok' : 'oo-dot--off'"
      />
      <div>
        <p class="oo-supervisor__label">
          {{ supervisorRunning ? "supervisor ativo" : "supervisor parado" }}
        </p>
        <p class="oo-supervisor__meta oo-mono">
          ciclo {{ supervisorCycle ?? "—" }} · prédio inteiro
        </p>
      </div>
    </div>

    <div class="oo-rail__profile">
      <span class="oo-avatar">{{ (userLogin ?? "?").slice(0, 1).toUpperCase() }}</span>
      <div class="oo-profile__meta">
        <p class="oo-profile__name">{{ userLogin ?? "—" }}</p>
        <p class="oo-profile__role">Administradora</p>
      </div>
      <button type="button" class="oo-logout" title="Sair" @click="emit('logout')">⏻</button>
    </div>
  </aside>
</template>

<style scoped>
.oo-rail {
  width: 244px;
  min-width: 244px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--oo-line);
  background: var(--oo-panel-2);
  height: 100%;
}

.oo-rail__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--oo-line-soft);
}

.oo-rail__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 13px;
}

.oo-rail__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--oo-green);
}

.oo-rail__theme {
  display: flex;
  gap: 4px;
}

.oo-theme-btn {
  width: 26px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid var(--oo-bd-btn);
  background: var(--oo-raise);
  font-size: 11px;
  cursor: pointer;
  opacity: 0.5;
}

.oo-theme-btn.is-active {
  opacity: 1;
  border-color: var(--oo-cta);
}

.oo-rail__floor {
  padding: 12px;
  border-bottom: 1px solid var(--oo-line-soft);
}

.oo-floor-collapsed,
.oo-floor-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 8px;
  border: 1px solid var(--oo-bd-btn);
  background: var(--oo-raise);
  color: var(--oo-ink);
  cursor: pointer;
  font-family: var(--oo-font);
  font-size: 12.5px;
  text-align: left;
}

.oo-floor-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.oo-floor-option.is-active {
  border-color: var(--oo-cta);
  background: var(--oo-sel);
}

.oo-floor-badge {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--oo-dash);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9.5px;
  font-weight: 700;
  font-family: var(--oo-mono);
  flex-shrink: 0;
}

.oo-floor-name {
  flex: 1;
  font-weight: 600;
}

.oo-floor-switch {
  color: var(--oo-muted-3);
  font-size: 12px;
}

.oo-rail__nav {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
}

.oo-nav-group {
  margin: 12px 4px 6px;
}

.oo-nav-group--building {
  margin-top: 20px;
}

.oo-nav-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--oo-muted);
  font-family: var(--oo-font);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: 2px;
}

.oo-nav-item:hover {
  background: var(--oo-hover);
  color: var(--oo-ink);
}

.oo-nav-item.is-active {
  background: var(--oo-sel);
  color: var(--oo-ink);
  font-weight: 600;
}

.oo-rail__supervisor {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--oo-line-soft);
}

.oo-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.oo-dot--ok {
  background: var(--oo-green);
}

.oo-dot--off {
  background: var(--oo-red);
}

.oo-supervisor__label {
  font-size: 11.5px;
  font-weight: 600;
}

.oo-supervisor__meta {
  font-size: 10.5px;
  color: var(--oo-muted-3);
}

.oo-rail__profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--oo-line-soft);
}

.oo-avatar {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--oo-cta);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.oo-profile__meta {
  flex: 1;
  min-width: 0;
}

.oo-profile__name {
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oo-profile__role {
  font-size: 10.5px;
  color: var(--oo-muted-3);
}

.oo-logout {
  border: none;
  background: transparent;
  color: var(--oo-muted-3);
  cursor: pointer;
  font-size: 14px;
}

.oo-logout:hover {
  color: var(--oo-red);
}
</style>
