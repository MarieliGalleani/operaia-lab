<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth";
import { usePendingApprovalsBadge } from "@/composables/usePendingApprovalsBadge";

interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly to: string;
  readonly badgeKey?: "approvals";
}

interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
  readonly collapsible?: boolean;
}

const groups: readonly NavGroup[] = [
  {
    title: "Trabalho",
    items: [
      { label: "Visão geral", icon: "status", to: "/app/command" },
      { label: "Nova demanda", icon: "plus", to: "/app/command/new" },
      { label: "Automações", icon: "auto", to: "/app/automations" },
      { label: "Missões", icon: "missions", to: "/app/missions" },
      { label: "Workspaces", icon: "folder", to: "/app/workspaces" },
    ],
  },
  {
    title: "Equipe",
    items: [
      { label: "Equipe digital", icon: "users", to: "/app/team" },
      { label: "Decisões", icon: "decision", to: "/app/decisions" },
      {
        label: "Aprovações",
        icon: "shield",
        to: "/app/command/approvals",
        badgeKey: "approvals",
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Execuções", icon: "activity", to: "/app/executions" },
      { label: "Infraestrutura", icon: "server", to: "/app/system/infra" },
      { label: "Configurações", icon: "settings", to: "/app/system/settings" },
    ],
  },
  {
    title: "Explorar",
    collapsible: true,
    items: [
      { label: "Campus", icon: "grid", to: "/app/campus" },
      { label: "Lab", icon: "building", to: "/app/office" },
      { label: "Sala da Opera", icon: "user", to: "/app/office/sala-ceo" },
    ],
  },
];

const experienceOpen = ref(false);
const flatItems = computed(() => groups.flatMap((g) => g.items));
const route = useRoute();
const router = useRouter();
const auth = useAuth();
const { pendingApprovals } = usePendingApprovalsBadge();

function isActive(to: string): boolean {
  if (
    to === "/app/command" ||
    to === "/app/campus" ||
    to === "/app/office"
  ) {
    return route.path === to;
  }
  return route.path === to || route.path.startsWith(`${to}/`);
}

const activeTo = computed(
  () => flatItems.value.find((item) => isActive(item.to))?.to,
);

const adminLogin = computed(() => auth.user.value?.login ?? "Administradora");
const adminInitial = computed(() => adminLogin.value.charAt(0).toUpperCase());

async function signOut(): Promise<void> {
  await auth.logout();
  await router.replace("/login");
}

function badgeFor(item: NavItem): number {
  if (item.badgeKey === "approvals") return pendingApprovals.value;
  return 0;
}
</script>

<template>
  <aside class="sidebar" aria-label="Navegação do escritório">
    <div class="sidebar__brand">
      <span class="sidebar__mark" aria-hidden="true">O</span>
      <div class="sidebar__brand-copy">
        <span class="sidebar__product">OperaIA</span>
        <span class="sidebar__hint">Command Center</span>
      </div>
    </div>

    <nav class="sidebar__nav">
      <div v-for="group in groups" :key="group.title" class="nav-group">
        <button
          v-if="group.collapsible"
          type="button"
          class="nav-group__toggle"
          :aria-expanded="experienceOpen"
          @click="experienceOpen = !experienceOpen"
        >
          <span class="nav-group__title">{{ group.title }}</span>
          <span class="nav-group__chev" aria-hidden="true">{{
            experienceOpen ? "▾" : "▸"
          }}</span>
        </button>
        <p v-else class="nav-group__title">{{ group.title }}</p>

        <div v-show="!group.collapsible || experienceOpen">
          <router-link
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :class="{ 'nav-item--active': item.to === activeTo }"
            :title="item.label"
          >
            <span class="nav-item__icon" aria-hidden="true">
              <svg
                v-if="item.icon === 'status'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <path d="M4 14h4v6H4zM10 9h4v11h-4zM16 4h4v16h-4z" />
              </svg>
              <svg
                v-else-if="item.icon === 'plus'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <svg
                v-else-if="item.icon === 'shield'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <path d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Z" />
              </svg>
              <svg
                v-else-if="item.icon === 'decision'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v5l3 2" />
              </svg>
              <svg
                v-else-if="item.icon === 'auto'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <path d="M4 12h4l2-6 3 12 2-6h5" />
              </svg>
              <svg
                v-else-if="item.icon === 'grid'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <svg
                v-else-if="item.icon === 'building'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <path d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5H11v15" />
                <path d="M11 20V3.5A1.5 1.5 0 0 1 12.5 2H18.5A1.5 1.5 0 0 1 20 3.5V20" />
                <path d="M7 9h1M7 13h1M15 7h1M15 11h1M15 15h1M3 20h18" />
              </svg>
              <svg
                v-else-if="item.icon === 'user'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
              </svg>
              <svg
                v-else-if="item.icon === 'users'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <circle cx="9" cy="8" r="3" />
                <path d="M3 19c1-3 3.5-4.5 6-4.5" />
                <circle cx="16.5" cy="9" r="2.5" />
                <path d="M14 19c.8-2.5 2.8-3.8 5-3.8 1 0 1.9.2 2.7.7" />
              </svg>
              <svg
                v-else-if="item.icon === 'folder'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <path
                  d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'missions'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <path d="M8 4h9.5A2.5 2.5 0 0 1 20 6.5v13l-4-2-4 2-4-2-4 2V8" />
                <path d="M8 4H6.5A2.5 2.5 0 0 0 4 6.5V20" />
                <path d="M10 9h6M10 13h4" />
              </svg>
              <svg
                v-else-if="item.icon === 'activity'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <path d="M3 12h4l2.5-6 3 12L15 9h6" />
              </svg>
              <svg
                v-else-if="item.icon === 'server'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <rect x="3" y="4" width="18" height="6" rx="1.5" />
                <rect x="3" y="14" width="18" height="6" rx="1.5" />
                <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
                <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
              </svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"
                />
              </svg>
            </span>
            <span class="nav-item__label">{{ item.label }}</span>
            <span
              v-if="badgeFor(item) > 0"
              class="nav-item__badge"
              aria-live="polite"
            >
              {{ badgeFor(item) }}
            </span>
          </router-link>
        </div>
      </div>
    </nav>

    <div class="sidebar__account">
      <div class="sidebar__user" :title="adminLogin">
        <span class="sidebar__avatar">{{ adminInitial }}</span>
        <div class="sidebar__user-copy">
          <span class="sidebar__user-name">{{ adminLogin }}</span>
          <span class="sidebar__user-role">Administradora</span>
        </div>
      </div>
      <button
        class="sidebar__logout"
        type="button"
        :disabled="auth.busy.value"
        @click="signOut"
      >
        Sair
      </button>
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
  overflow-y: auto;
}

.sidebar__brand {
  display: flex;
  align-items: center;
  padding: 4px 8px 20px;
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

.nav-group {
  margin-bottom: 12px;
}

.nav-group__title {
  margin: 0 0 4px;
  padding: 0 10px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-soft);
}

.nav-group__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: none;
  color: inherit;
  padding: 0;
  margin-bottom: 4px;
  cursor: pointer;
}

.nav-group__toggle .nav-group__title {
  margin: 0;
}

.nav-group__chev {
  padding-right: 10px;
  color: var(--text-soft);
  font-size: 10px;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 9px 10px;
  margin-bottom: 2px;
  border-radius: 10px;
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 500;
  transition:
    background 0.15s var(--ease),
    color 0.15s var(--ease),
    transform 0.15s var(--ease);
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

.nav-item__label {
  flex: 1;
  min-width: 0;
}

.nav-item__badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--danger);
  color: #1a0505;
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  transform: translateX(2px);
}

.nav-item--active {
  background: linear-gradient(
    90deg,
    rgba(59, 130, 246, 0.18),
    rgba(59, 130, 246, 0.08)
  );
  color: var(--text);
  box-shadow: inset 2px 0 0 var(--brand);
}

.nav-item--active .nav-item__icon {
  color: var(--brand);
}

.sidebar__account {
  margin-top: auto;
  padding: 14px 8px 4px;
  border-top: 1px solid var(--border);
}

.sidebar__user {
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

.sidebar__logout {
  width: 100%;
  margin-top: 10px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  background: transparent;
  font-size: var(--text-xs);
  text-align: left;
}

.sidebar__logout:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--border-strong);
  background: var(--surface-hover);
}

.sidebar__logout:disabled {
  cursor: wait;
  opacity: 0.6;
}

@media (max-width: 768px) {
  .sidebar {
    width: 64px;
    min-width: 64px;
    padding: 16px 8px;
  }

  .sidebar__brand-copy,
  .nav-group__title,
  .nav-item__label,
  .sidebar__user-copy,
  .nav-group__chev,
  .nav-item__badge {
    display: none;
  }

  .sidebar__brand {
    justify-content: center;
    padding: 4px 0 16px;
  }

  .sidebar__mark {
    margin: 0;
  }

  .nav-item {
    justify-content: center;
    padding: 10px;
  }

  .nav-item__icon {
    margin-right: 0;
  }

  .sidebar__user {
    justify-content: center;
  }

  .sidebar__logout {
    padding: 8px 4px;
    text-align: center;
    font-size: 10px;
  }
}
</style>
