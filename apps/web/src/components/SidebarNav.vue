<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly to: string;
}

const items: readonly NavItem[] = [
  { label: "Escritório", icon: "🏢", to: "/office" },
  { label: "Sala da CEO", icon: "👩🏻‍💼", to: "/office/sala-ceo" },
  { label: "Equipe", icon: "👥", to: "/office/equipe" },
  { label: "Projetos", icon: "🚀", to: "/office/projetos" },
  { label: "Central de atividades", icon: "📡", to: "/office/atividades" },
  { label: "Conhecimento", icon: "📚", to: "/office/conhecimento" },
  { label: "Configurações", icon: "⚙️", to: "/office/configuracoes" },
];

const route = useRoute();

function isActive(to: string): boolean {
  if (to === "/office") {
    return route.path === "/office";
  }
  return route.path.startsWith(to);
}

const activeTo = computed(() => items.find((item) => isActive(item.to))?.to);
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <span class="sidebar__logo">◑</span>
      <div>
        <strong>OperaIA</strong><span class="sidebar__brand-dot">.lab</span>
        <div class="sidebar__brand-sub">Escritório Virtual</div>
      </div>
    </div>

    <nav class="sidebar__nav">
      <router-link
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        :class="{ 'nav-item--active': item.to === activeTo }"
      >
        <span class="nav-item__icon">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="sidebar__user">
      <span class="sidebar__avatar">M</span>
      <div>
        <strong>Marieli</strong>
        <div class="sidebar__user-sub">Fundadora</div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 258px;
  min-width: 258px;
  height: 100vh;
  position: sticky;
  top: 0;
  background: linear-gradient(180deg, var(--sidebar-bg), var(--sidebar-bg-2));
  color: var(--sidebar-text);
  display: flex;
  flex-direction: column;
  padding: 22px 16px;
}

.sidebar__brand {
  display: flex;
  align-items: center;
  padding: 6px 10px 22px;
}

.sidebar__logo {
  font-size: 26px;
  color: #a5b4fc;
  margin-right: 12px;
}

.sidebar__brand strong {
  color: #fff;
  font-size: 18px;
}

.sidebar__brand-dot {
  color: #818cf8;
  font-weight: 700;
}

.sidebar__brand-sub {
  font-size: 12px;
  color: #7c88a1;
  margin-top: 2px;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 11px 12px;
  margin-bottom: 4px;
  border-radius: var(--radius-sm);
  color: var(--sidebar-text);
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
}

.nav-item__icon {
  margin-right: 12px;
  font-size: 16px;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.nav-item--active {
  background: var(--brand);
  color: #fff;
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.35);
}

.sidebar__user {
  margin-top: auto;
  display: flex;
  align-items: center;
  padding: 12px 10px 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #6366f1;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  margin-right: 12px;
}

.sidebar__user strong {
  color: #fff;
  font-size: 14px;
}

.sidebar__user-sub {
  font-size: 12px;
  color: #7c88a1;
}
</style>
