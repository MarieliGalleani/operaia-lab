<script setup lang="ts">
/**
 * Rail do Escritorio Operacional (P1.21) — casca principal do app,
 * substitui SidebarNav.vue nas rotas de floor/sistema. Estrutura e
 * tokens copiados do handoff de design (OperationalOffice.dc.html)
 * aprovado pela usuaria, adaptados pra navegar por rotas reais do
 * Vue Router em vez de estado local de aba (o handoff era uma
 * maquete solta; aqui cada item e uma pagina real, com URL propria).
 */
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { OFFICE_FLOORS, floorIdFromPath, type OfficeFloorDef } from "@/data/office-floors";
import { useAppTheme } from "@/composables/useAppTheme";
import { useAuth } from "@/composables/useAuth";

const route = useRoute();
const router = useRouter();
const { theme, toggle: toggleTheme } = useAppTheme();
const auth = useAuth();

const props = defineProps<{
  workCount: number | null;
  teamCount: string | null;
  todayCount: number | null;
}>();

const railFloorOpen = ref(false);

const activeFloor = computed<OfficeFloorDef>(() => {
  const id = floorIdFromPath(route.path);
  return OFFICE_FLOORS.find((f) => f.id === id) ?? OFFICE_FLOORS[0]!;
});

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`);
}

function goFloor(id: string): void {
  const floor = OFFICE_FLOORS.find((f) => f.id === id);
  if (floor) router.push(floor.todayRoute);
  railFloorOpen.value = false;
}

async function signOut(): Promise<void> {
  await auth.logout();
  await router.replace("/login");
}

const adminLogin = computed(() => auth.user.value?.login ?? "administradora");

const NAV_ICONS: Record<string, string> = {
  today: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11l2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6",
};
</script>

<template>
  <nav class="op-rail">
    <div class="op-rail__brand">
      <div class="op-rail__brand-row">
        <span class="op-rail__dot" />
        <span class="op-rail__product">Operaia.lab</span>
        <div class="op-rail__theme">
          <button
            type="button"
            class="op-theme-btn"
            :class="{ 'is-active': theme === 'dark' }"
            aria-label="Escuro"
            @click="toggleTheme"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          </button>
          <button
            type="button"
            class="op-theme-btn"
            :class="{ 'is-active': theme === 'light' }"
            aria-label="Claro"
            @click="toggleTheme"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
          </button>
        </div>
      </div>
    </div>

    <div class="op-rail__floor">
      <p class="op-eyebrow">Andar</p>
      <div v-if="railFloorOpen" class="op-floor-list">
        <button
          v-for="f in OFFICE_FLOORS"
          :key="f.id"
          type="button"
          class="op-floor-option"
          :class="{ 'is-active': f.id === activeFloor.id }"
          @click="goFloor(f.id)"
        >
          <span class="op-floor-badge">{{ f.code }}</span>
          <span class="op-floor-copy">
            <span class="op-floor-name">{{ f.name }}</span>
            <span class="op-floor-meta">{{ f.meta }}</span>
          </span>
        </button>
      </div>
      <button
        v-else
        type="button"
        class="op-floor-collapsed"
        :aria-label="`Andar atual: ${activeFloor.name}. Trocar andar`"
        @click="railFloorOpen = true"
      >
        <span class="op-floor-badge">{{ activeFloor.code }}</span>
        <span class="op-floor-name" style="flex: 1">{{ activeFloor.name }}</span>
        <span class="op-floor-switch" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
        </span>
      </button>
    </div>

    <div class="op-rail__nav">
      <p class="op-eyebrow">{{ activeFloor.name }}</p>

      <router-link :to="activeFloor.todayRoute" class="op-nav-item" aria-label="Hoje" :class="{ 'is-active': isActive(activeFloor.todayRoute) }">
        <svg class="op-nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="NAV_ICONS.today" /></svg>
        <span class="op-nav-label">Hoje</span>
        <span class="op-nav-count">{{ props.todayCount ?? "" }}</span>
      </router-link>

      <router-link :to="activeFloor.workRoute" class="op-nav-item" aria-label="Trabalhos" :class="{ 'is-active': isActive(activeFloor.workRoute) }">
        <svg class="op-nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
        <span class="op-nav-label">Trabalhos</span>
        <span class="op-nav-count">{{ props.workCount ?? "" }}</span>
      </router-link>

      <router-link :to="activeFloor.teamRoute" class="op-nav-item" aria-label="Equipe" :class="{ 'is-active': isActive(activeFloor.teamRoute) }">
        <svg class="op-nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
        <span class="op-nav-label">Equipe</span>
        <span class="op-nav-count">{{ props.teamCount ?? "" }}</span>
      </router-link>

      <router-link :to="activeFloor.signalsRoute" class="op-nav-item" aria-label="Sinais" :class="{ 'is-active': isActive(activeFloor.signalsRoute) }">
        <svg class="op-nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l3 8 4-16 3 8h4" /></svg>
        <span class="op-nav-label">Sinais</span>
        <span class="op-nav-count"></span>
      </router-link>

      <p class="op-eyebrow op-eyebrow--building">Prédio</p>
      <router-link to="/app/system/infra" class="op-nav-item" aria-label="Infraestrutura" :class="{ 'is-active': isActive('/app/system/infra') }">
        <svg class="op-nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="14" width="6" height="7" /><rect x="9" y="8" width="6" height="13" /><rect x="16" y="3" width="6" height="18" /></svg>
        <span class="op-nav-label">Infraestrutura</span>
        <span class="op-nav-count"></span>
      </router-link>
      <router-link to="/app/system/settings" class="op-nav-item" aria-label="Configurações" :class="{ 'is-active': isActive('/app/system/settings') }">
        <svg class="op-nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></svg>
        <span class="op-nav-label">Configurações</span>
        <span class="op-nav-count"></span>
      </router-link>
    </div>

    <div class="op-rail__account">
      <span class="op-avatar" :title="adminLogin">{{ adminLogin.slice(0, 1).toUpperCase() }}</span>
      <div class="op-account-copy">
        <p class="op-account-name">{{ adminLogin }}</p>
        <p class="op-account-role">Administradora</p>
      </div>
      <button type="button" class="op-logout" aria-label="Sair" @click="signOut">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.op-rail {
  display: flex;
  flex-direction: column;
  width: 244px;
  min-width: 244px;
  height: 100vh;
  background: var(--op-panel);
  border-right: 1px solid var(--op-line);
  overflow: visible;
  font-family: "Sora", sans-serif;
  color: var(--op-ink-3);
}

.op-rail__brand {
  padding: 20px 18px 14px;
}

.op-rail__brand-row {
  display: flex;
  align-items: center;
  gap: 9px;
}

.op-rail__dot {
  width: 7px;
  height: 7px;
  border-radius: var(--op-radius-full);
  background: var(--op-green);
  box-shadow: 0 0 0 3px var(--op-halo);
  animation: op-breathe 3s ease-in-out infinite;
}

.op-rail__product {
  font-family: var(--op-font-mono);
  font-size: 10.5px;
  letter-spacing: 0.14em;
  color: var(--op-muted-4);
  text-transform: uppercase;
}

.op-rail__theme {
  display: inline-flex;
  padding: 2px;
  margin-left: auto;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
}

.op-theme-btn {
  width: 26px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--op-radius-xs);
  background: transparent;
  color: var(--op-muted-4);
  cursor: pointer;
}

.op-theme-btn.is-active {
  background: var(--op-sel);
  color: var(--op-ink-2);
}

.op-eyebrow {
  padding: 0 6px 8px;
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  color: var(--op-muted-6);
  text-transform: uppercase;
}

.op-eyebrow--building {
  margin-top: 18px;
}

.op-rail__floor {
  padding: 0 12px 14px;
  border-bottom: 1px solid var(--op-line);
}

.op-floor-collapsed,
.op-floor-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--op-bd-sel);
  border-radius: var(--op-radius-sm);
  background: var(--op-sel);
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.op-floor-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.op-floor-option {
  border-color: transparent;
  background: transparent;
}

.op-floor-option.is-active {
  border-color: var(--op-bd-sel);
  background: var(--op-sel);
}

.op-floor-badge {
  width: 26px;
  height: 26px;
  border-radius: var(--op-radius-sm);
  background: var(--op-raise);
  display: grid;
  place-items: center;
  font-family: var(--op-font-mono);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--op-muted-2);
  flex-shrink: 0;
}

.op-floor-option.is-active .op-floor-badge {
  color: var(--op-ink-2);
}

.op-floor-copy {
  flex: 1;
  min-width: 0;
}

.op-floor-name {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--op-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.op-floor-meta {
  display: block;
  margin-top: 2px;
  font-family: var(--op-font-mono);
  font-size: 10px;
  color: var(--op-muted-6);
}

.op-floor-switch {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-xs);
  color: var(--op-muted-2);
  flex-shrink: 0;
}

.op-rail__nav {
  flex: 1;
  overflow-y: auto;
  padding: 14px 12px;
}

.op-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 9px 10px;
  margin-bottom: 2px;
  border: 0;
  border-radius: var(--op-radius-sm);
  background: transparent;
  color: var(--op-muted-2);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}

.op-nav-item:hover {
  background: var(--op-sel);
  color: var(--op-ink-3);
}

.op-nav-item.is-active {
  background: var(--op-sel);
  color: var(--op-ink-2);
  font-weight: 600;
}

.op-nav-icon {
  flex-shrink: 0;
}

.op-nav-label {
  flex: 1;
}

.op-nav-count {
  font-family: var(--op-font-mono);
  font-size: 10.5px;
  color: var(--op-muted-6);
}

.op-rail__account {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px 14px;
  border-top: 1px solid var(--op-line);
}

.op-avatar {
  width: 30px;
  height: 30px;
  border-radius: var(--op-radius-sm);
  background: var(--op-cta);
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.op-account-copy {
  flex: 1;
  min-width: 0;
}

.op-account-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--op-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.op-account-role {
  margin-top: 1px;
  font-size: 11px;
  color: var(--op-muted-4);
}

.op-logout {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: var(--op-radius-xs);
  background: transparent;
  color: var(--op-muted-4);
  cursor: pointer;
  flex-shrink: 0;
}

.op-logout:hover {
  background: var(--op-sel);
  color: var(--op-ink-3);
}

@keyframes op-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

/**
 * P1.X-FIX (REG-06): equivalente ao colapso que o SidebarNav.vue antigo
 * ja tinha em 768px (rail vira coluna so-icone de 64px) — o rail novo
 * nao tinha nenhum comportamento mobile. Nenhuma acao e removida, so o
 * texto; todo item mantem aria-label e continua clicavel/navegavel.
 * O seletor de andar expandido vira um popover flutuante nessa largura
 * (em vez de empurrar o rail inteiro), pra caber nome+meta legivel.
 */
@media (max-width: 768px) {
  .op-rail {
    width: 64px;
    min-width: 64px;
  }

  .op-rail__brand {
    padding: 16px 8px 12px;
  }

  .op-rail__brand-row {
    flex-direction: column;
    gap: 10px;
  }

  .op-rail__product {
    display: none;
  }

  .op-rail__theme {
    margin-left: 0;
  }

  .op-eyebrow {
    display: none;
  }

  .op-rail__floor {
    padding: 0 8px 12px;
    position: relative;
  }

  .op-floor-collapsed {
    justify-content: center;
    padding: 8px;
  }

  .op-floor-name,
  .op-floor-switch {
    display: none;
  }

  .op-floor-list {
    position: absolute;
    top: 0;
    left: calc(100% + 8px);
    z-index: 30;
    width: 220px;
    padding: 6px;
    border: 1px solid var(--op-line-strong);
    border-radius: var(--op-radius-sm);
    background: var(--op-panel);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.32);
  }

  .op-floor-option {
    padding: 9px 10px;
  }

  .op-nav-item {
    justify-content: center;
    padding: 10px 0;
  }

  .op-nav-label,
  .op-nav-count {
    display: none;
  }

  .op-rail__account {
    padding: 12px 8px 14px;
    justify-content: center;
  }

  .op-account-copy {
    display: none;
  }
}
</style>
