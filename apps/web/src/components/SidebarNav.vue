<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly to: string;
}

const items: readonly NavItem[] = [
  { label: "Campus", icon: "grid", to: "/campus" },
  { label: "OperaIA.lab", icon: "building", to: "/office" },
  { label: "Sala da CEO", icon: "user", to: "/office/sala-ceo" },
  { label: "Equipe", icon: "users", to: "/office/equipe" },
  { label: "Projetos", icon: "folder", to: "/office/projetos" },
  { label: "Central de atividades", icon: "activity", to: "/office/atividades" },
  { label: "Conhecimento", icon: "book", to: "/office/conhecimento" },
  { label: "Painel VPS", icon: "server", to: "/office/vps" },
  { label: "Configurações", icon: "settings", to: "/office/configuracoes" },
];

const route = useRoute();

function isActive(to: string): boolean {
  if (to === "/campus" || to === "/office") {
    return route.path === to;
  }
  return route.path.startsWith(to);
}

const activeTo = computed(() => items.find((item) => isActive(item.to))?.to);
</script>

<template>
  <aside class="sidebar" aria-label="Navegação do escritório">
    <div class="sidebar__brand">
      <span class="sidebar__mark" aria-hidden="true">O</span>
      <div class="sidebar__brand-copy">
        <span class="sidebar__product">OperaIA</span>
        <span class="sidebar__hint">Campus & Lab</span>
      </div>
    </div>

    <nav class="sidebar__nav">
      <router-link
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        :class="{ 'nav-item--active': item.to === activeTo }"
        :title="item.label"
      >
        <span class="nav-item__icon" aria-hidden="true">
          <svg v-if="item.icon === 'grid'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <svg v-else-if="item.icon === 'building'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5H11v15" />
            <path d="M11 20V3.5A1.5 1.5 0 0 1 12.5 2H18.5A1.5 1.5 0 0 1 20 3.5V20" />
            <path d="M7 9h1M7 13h1M15 7h1M15 11h1M15 15h1M3 20h18" />
          </svg>
          <svg v-else-if="item.icon === 'user'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
          </svg>
          <svg v-else-if="item.icon === 'users'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <circle cx="9" cy="8" r="3" />
            <path d="M3 19c1-3 3.5-4.5 6-4.5" />
            <circle cx="16.5" cy="9" r="2.5" />
            <path d="M14 19c.8-2.5 2.8-3.8 5-3.8 1 0 1.9.2 2.7.7" />
          </svg>
          <svg v-else-if="item.icon === 'folder'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
          </svg>
          <svg v-else-if="item.icon === 'activity'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M3 12h4l2.5-6 3 12L15 9h6" />
          </svg>
          <svg v-else-if="item.icon === 'book'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v16H7.5A2.5 2.5 0 0 0 5 20.5V4.5Z" />
            <path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H19" />
          </svg>
          <svg v-else-if="item.icon === 'server'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <rect x="3" y="4" width="18" height="6" rx="1.5" />
            <rect x="3" y="14" width="18" height="6" rx="1.5" />
            <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
            <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
          </svg>
        </span>
        <span class="nav-item__label">{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="sidebar__user" title="Marieli — Fundadora">
      <span class="sidebar__avatar">M</span>
      <div class="sidebar__user-copy">
        <span class="sidebar__user-name">Marieli</span>
        <span class="sidebar__user-role">Fundadora</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 236px;
  min-width: 236px;
  height: 100vh;
  position: sticky;
  top: 0;
  background:
    radial-gradient(ellipse at 0% 0%, rgba(59, 130, 246, 0.1), transparent 42%),
    linear-gradient(180deg, #070b14 0%, #060a12 100%);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 20px 12px;
  z-index: 2;
}

.sidebar__brand {
  display: flex;
  align-items: center;
  padding: 4px 8px 24px;
}

.sidebar__mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(145deg, #3b82f6, #1d4ed8);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  box-shadow:
    0 0 0 4px rgba(59, 130, 246, 0.12),
    0 8px 20px rgba(37, 99, 235, 0.25);
  flex-shrink: 0;
}

.sidebar__brand-copy {
  display: flex;
  flex-direction: column;
  margin-left: 10px;
  min-width: 0;
}

.sidebar__product {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}

.sidebar__hint {
  margin-top: 2px;
  font-size: 10px;
  color: var(--text-soft);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 10px 10px;
  margin-bottom: 2px;
  border-radius: 10px;
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s var(--ease), color 0.15s var(--ease), transform 0.15s var(--ease);
}

.nav-item__icon {
  width: 20px;
  height: 20px;
  margin-right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-item__icon svg {
  width: 18px;
  height: 18px;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  transform: translateX(2px);
}

.nav-item--active {
  background:
    linear-gradient(90deg, rgba(59, 130, 246, 0.18), rgba(59, 130, 246, 0.08));
  color: var(--text);
  box-shadow: inset 2px 0 0 var(--brand);
}

.nav-item--active .nav-item__icon {
  color: var(--brand);
}

.sidebar__user {
  margin-top: auto;
  padding: 14px 8px 4px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
}

.sidebar__avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
}

.sidebar__user-copy {
  display: flex;
  flex-direction: column;
  margin-left: 10px;
  min-width: 0;
}

.sidebar__user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.sidebar__user-role {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-soft);
}
</style>
