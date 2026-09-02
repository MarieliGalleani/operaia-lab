<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { OFFICE_FLOORS, type OfficeFloorDef } from "@/data/office-floors";

/**
 * P1.X-FIX: withDefaults e obrigatorio aqui. Prop opcional tipada como
 * boolean, quando NAO passada, o Vue 3 "casta" pra false (nao
 * undefined) — sem isso, `showRefresh !== false` dava false sempre que
 * a tela nao passava a prop explicitamente, escondendo o botao
 * Atualizar/CTA em toda tela que so queria o padrao (mostrar). Foi
 * assim que o fix do REG-03/04 (botao morto) virou "botao sumido" —
 * pego numa verificacao visual real antes do deploy.
 */
const props = withDefaults(
  defineProps<{
    floor: OfficeFloorDef;
    scopeLine: string;
    title: string;
    lede: string;
    refreshing?: boolean;
    showCta?: boolean;
    showRefresh?: boolean;
  }>(),
  {
    showCta: true,
    showRefresh: true,
  },
);

const emit = defineEmits<{
  (e: "refresh"): void;
}>();

const router = useRouter();
const menuOpen = ref(false);

function pick(id: string): void {
  const floor = OFFICE_FLOORS.find((f) => f.id === id);
  menuOpen.value = false;
  if (floor) router.push(floor.todayRoute);
}

function goNewWork(): void {
  router.push(props.floor.newWorkRoute);
}
</script>

<template>
  <header class="op-header">
    <div class="op-header__left">
      <div class="op-floor-dropdown">
        <button type="button" class="op-floor-trigger" @click="menuOpen = !menuOpen">
          <span class="op-floor-chip">{{ floor.code }}</span>
          <span class="op-scope">{{ scopeLine }}</span>
          <span class="op-caret" :style="{ transform: menuOpen ? 'rotate(180deg)' : 'none' }">▾</span>
        </button>
        <div v-if="menuOpen" class="op-floor-menu">
          <button
            v-for="f in OFFICE_FLOORS"
            :key="f.id"
            type="button"
            class="op-floor-menu-item"
            :class="{ 'is-active': f.id === floor.id }"
            @click="pick(f.id)"
          >
            <span class="op-floor-chip">{{ f.code }}</span>
            <span class="op-floor-menu-copy">
              <span class="op-floor-menu-name">{{ f.name }}</span>
              <span class="op-floor-menu-meta">{{ f.meta }}</span>
            </span>
          </button>
        </div>
      </div>
      <h1 class="op-title">{{ title }}</h1>
      <p class="op-lede">{{ lede }}</p>
    </div>
    <div class="op-header__right">
      <slot name="extra" />
      <button
        v-if="showRefresh !== false"
        type="button"
        class="op-btn"
        :disabled="refreshing"
        @click="emit('refresh')"
      >
        {{ refreshing ? "Atualizando…" : "Atualizar" }}
      </button>
      <button v-if="showCta !== false" type="button" class="op-btn op-btn--cta" @click="goNewWork">
        {{ floor.newWorkLabel }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.op-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  padding: 22px 34px 18px;
  border-bottom: 1px solid var(--op-line);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.op-header__left {
  min-width: 0;
}

.op-floor-dropdown {
  position: relative;
  display: inline-block;
}

.op-floor-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 4px 3px 3px;
  border: 0;
  border-radius: var(--op-radius-xs);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}

.op-floor-trigger:hover {
  background: var(--op-sel);
}

.op-floor-chip {
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  padding: 3px 7px;
  border-radius: var(--op-radius-xs);
  background: var(--op-raise);
  color: var(--op-muted-2);
}

.op-scope {
  font-family: var(--op-font-mono);
  font-size: 10.5px;
  letter-spacing: 0.14em;
  color: var(--op-muted-5);
  text-transform: uppercase;
}

.op-caret {
  font-size: 9px;
  color: var(--op-muted-5);
  transition: transform 0.15s ease;
}

.op-floor-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  width: 240px;
  padding: 6px;
  border: 1px solid var(--op-line-strong);
  border-radius: var(--op-radius-sm);
  background: var(--op-panel);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
}

.op-floor-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px;
  margin-bottom: 2px;
  border: 1px solid transparent;
  border-radius: var(--op-radius-sm);
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.op-floor-menu-item:hover {
  background: var(--op-raise);
}

.op-floor-menu-item.is-active {
  border-color: var(--op-bd-sel);
  background: var(--op-sel);
}

.op-floor-menu-copy {
  flex: 1;
  min-width: 0;
}

.op-floor-menu-name {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-floor-menu-meta {
  display: block;
  margin-top: 1px;
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  color: var(--op-muted-6);
}

.op-title {
  margin-top: 9px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.032em;
  color: var(--op-ink);
}

.op-lede {
  margin-top: 5px;
  font-size: 13.5px;
  color: var(--op-muted-3);
  max-width: 64ch;
}

.op-header__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.op-btn {
  padding: 9px 15px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  background: transparent;
  color: var(--op-muted);
  font-family: "Sora", sans-serif;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.op-btn:hover:not(:disabled) {
  border-color: var(--op-bd-btn-h);
  color: var(--op-ink-3);
  background: var(--op-raise);
}

.op-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.op-btn--cta {
  padding: 9px 16px;
  border-color: var(--op-cta);
  background: var(--op-cta);
  color: #fff;
  font-weight: 600;
}

.op-btn--cta:hover:not(:disabled) {
  background: var(--op-cta-h);
  border-color: var(--op-cta-h);
}
</style>
