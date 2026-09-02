<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import type { OfficeFloorDef } from "@/data/office-floors";

const props = defineProps<{
  floors: readonly OfficeFloorDef[];
  activeFloorId: string;
  title: string;
  description: string;
  breadcrumb: string;
  refreshing: boolean;
}>();

const emit = defineEmits<{
  (e: "floor-change", id: string): void;
  (e: "refresh"): void;
}>();

const router = useRouter();
const dropdownOpen = ref(false);

function activeFloor(): OfficeFloorDef {
  return props.floors.find((f) => f.id === props.activeFloorId) ?? props.floors[0]!;
}

function pick(id: string): void {
  emit("floor-change", id);
  dropdownOpen.value = false;
}

function goToNewWork(): void {
  router.push(activeFloor().newWorkRoute);
}
</script>

<template>
  <header class="oo-header">
    <div class="oo-header__left">
      <div class="oo-floor-dropdown">
        <button type="button" class="oo-floor-dropdown__trigger" @click="dropdownOpen = !dropdownOpen">
          <span class="oo-floor-badge">{{ activeFloor().code }}</span>
          <span>{{ activeFloor().name }}</span>
          <span class="oo-caret">▾</span>
        </button>
        <div v-if="dropdownOpen" class="oo-floor-dropdown__menu">
          <button
            v-for="floor in floors"
            :key="floor.id"
            type="button"
            class="oo-floor-dropdown__item"
            :class="{ 'is-active': floor.id === activeFloorId }"
            @click="pick(floor.id)"
          >
            <span class="oo-floor-badge">{{ floor.code }}</span>
            <span>{{ floor.name }}</span>
          </button>
        </div>
      </div>
      <p class="oo-breadcrumb">{{ breadcrumb }}</p>
      <h1 class="oo-title">{{ title }}</h1>
      <p class="oo-description">{{ description }}</p>
    </div>
    <div class="oo-header__right">
      <button type="button" class="oo-btn" :disabled="refreshing" @click="emit('refresh')">
        {{ refreshing ? "Atualizando…" : "Atualizar" }}
      </button>
      <button type="button" class="oo-btn oo-btn--cta" @click="goToNewWork">
        {{ activeFloor().newWorkLabel }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.oo-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px;
  border-bottom: 1px solid var(--oo-line);
  flex-wrap: wrap;
}

.oo-header__left {
  min-width: 0;
}

.oo-floor-dropdown {
  position: relative;
  display: inline-block;
  margin-bottom: 10px;
}

.oo-floor-dropdown__trigger {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 10px 5px 5px;
  border-radius: 8px;
  border: 1px solid var(--oo-bd-btn);
  background: var(--oo-raise);
  color: var(--oo-ink);
  font-family: var(--oo-font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.oo-floor-badge {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--oo-dash);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  font-family: var(--oo-mono);
  flex-shrink: 0;
}

.oo-caret {
  color: var(--oo-muted-3);
  font-size: 10px;
}

.oo-floor-dropdown__menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  min-width: 200px;
  background: var(--oo-panel);
  border: 1px solid var(--oo-line);
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.oo-floor-dropdown__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--oo-ink);
  font-family: var(--oo-font);
  font-size: 12.5px;
  cursor: pointer;
  text-align: left;
}

.oo-floor-dropdown__item:hover,
.oo-floor-dropdown__item.is-active {
  background: var(--oo-sel);
}

.oo-breadcrumb {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--oo-muted-3);
  margin-bottom: 6px;
}

.oo-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.oo-description {
  font-size: 13px;
  color: var(--oo-muted);
  max-width: 560px;
}

.oo-header__right {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
