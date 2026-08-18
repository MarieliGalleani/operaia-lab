import {
  createRouter,
  createWebHistory,
  RouterView,
  type Router,
  type RouterHistory,
  type RouteRecordRaw,
} from "vue-router";
import { setUnauthorizedHandler } from "@/data/adapters/http-client";
import {
  authSession,
  type AuthSession,
} from "@/modules/auth/auth-session";
import OfficeLayout from "@/layouts/OfficeLayout.vue";
import LoginView from "@/views/LoginView.vue";
import CampusWorldPage from "@/views/CampusWorldPage.vue";
import OfficeWorldPage from "@/views/OfficeWorldPage.vue";
import ExecutiveRoom from "@/views/ExecutiveRoom.vue";
import ProjectsView from "@/views/ProjectsView.vue";
import WorkspaceRoom from "@/views/WorkspaceRoom.vue";
import EmployeeRoom from "@/views/EmployeeRoom.vue";
import ActivityCenter from "@/views/ActivityCenter.vue";
import KnowledgeView from "@/views/KnowledgeView.vue";
import SettingsView from "@/views/SettingsView.vue";
import VpsPanelView from "@/views/VpsPanelView.vue";
import MissionsView from "@/views/MissionsView.vue";
import MissionDetailView from "@/views/MissionDetailView.vue";
import VirtualWorldTest from "@/views/VirtualWorldTest.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/app" },
  {
    path: "/login",
    name: "login",
    component: LoginView,
    meta: { publicOnly: true },
  },
  {
    path: "/register",
    redirect: {
      name: "login",
      query: { registration: "disabled" },
    },
  },
  {
    path: "/app",
    component: RouterView,
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        redirect: "/app/campus",
      },
      {
        path: "campus",
        component: OfficeLayout,
        children: [
          { path: "", name: "campus", component: CampusWorldPage },
        ],
      },
      {
        path: "office",
        component: OfficeLayout,
        children: [
          { path: "", name: "office", component: OfficeWorldPage },
          { path: "sala-ceo", name: "ceo-room", component: ExecutiveRoom },
          { path: "equipe", name: "team", component: EmployeeRoom },
          { path: "projetos", name: "projects", component: ProjectsView },
          {
            path: "projetos/:id",
            name: "workspace",
            component: WorkspaceRoom,
            props: true,
          },
          { path: "missions", name: "missions", component: MissionsView },
          {
            path: "missions/:id",
            name: "mission-detail",
            component: MissionDetailView,
            props: true,
          },
          {
            path: "atividades",
            name: "activities",
            component: ActivityCenter,
          },
          {
            path: "conhecimento",
            name: "knowledge",
            component: KnowledgeView,
          },
          { path: "vps", name: "vps-panel", component: VpsPanelView },
          {
            path: "configuracoes",
            name: "settings",
            component: SettingsView,
          },
        ],
      },
      {
        path: "virtual-world-test",
        name: "virtual-world-test",
        component: VirtualWorldTest,
      },
    ],
  },
  { path: "/campus", redirect: "/app/campus" },
  {
    path: "/office/:pathMatch(.*)*",
    redirect: (to) => {
      const pathMatch = to.params.pathMatch;
      const suffix = Array.isArray(pathMatch)
        ? pathMatch.join("/")
        : (pathMatch ?? "");
      return `/app/office${suffix ? `/${suffix}` : ""}`;
    },
  },
  { path: "/virtual-world-test", redirect: "/app/virtual-world-test" },
];

export function createAppRouter(
  session: AuthSession = authSession,
  history: RouterHistory = createWebHistory(),
): Router {
  const appRouter = createRouter({ history, routes });

  appRouter.beforeEach(async (to) => {
    await session.ensureInitialized();
    const requiresAuth = to.matched.some(
      (record) => record.meta.requiresAuth === true,
    );
    if (requiresAuth && !session.isAuthenticated.value) {
      return {
        name: "login",
        query: { redirect: to.fullPath },
      };
    }
    if (to.meta.publicOnly === true && session.isAuthenticated.value) {
      return "/app";
    }
    return true;
  });

  setUnauthorizedHandler(() => {
    if (!session.expire() || appRouter.currentRoute.value.name === "login") {
      return;
    }
    void appRouter.replace({ name: "login" });
  });
  return appRouter;
}

export const router = createAppRouter();
