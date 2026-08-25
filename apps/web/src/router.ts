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
import OfficeStatusView from "@/views/OfficeStatusView.vue";
import VirtualWorldTest from "@/views/VirtualWorldTest.vue";
import CommandCenterView from "@/views/command-center/CommandCenterView.vue";
import NewDemandView from "@/views/command-center/NewDemandView.vue";
import ApprovalsView from "@/views/command-center/ApprovalsView.vue";
import ApprovalDetailView from "@/views/command-center/ApprovalDetailView.vue";
import DecisionsView from "@/views/decisions/DecisionsView.vue";
import DecisionDetailView from "@/views/decisions/DecisionDetailView.vue";
import AutomationsView from "@/views/automations/AutomationsView.vue";
import AutomationDetailView from "@/views/automations/AutomationDetailView.vue";
import ExecutionsView from "@/views/executions/ExecutionsView.vue";
import ExecutionDetailView from "@/views/executions/ExecutionDetailView.vue";

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
      { path: "", redirect: "/app/command" },
      {
        path: "campus",
        component: OfficeLayout,
        children: [
          { path: "", name: "campus", component: CampusWorldPage },
        ],
      },
      {
        path: "command",
        component: OfficeLayout,
        children: [
          { path: "", name: "command", component: CommandCenterView },
          { path: "new", name: "command-new", component: NewDemandView },
          {
            path: "approvals",
            name: "command-approvals",
            component: ApprovalsView,
          },
          {
            path: "approvals/:id",
            name: "command-approval-detail",
            component: ApprovalDetailView,
            props: true,
          },
        ],
      },
      {
        path: "missions",
        component: OfficeLayout,
        children: [
          { path: "", name: "missions", component: MissionsView },
          {
            path: ":id",
            name: "mission-detail",
            component: MissionDetailView,
            props: true,
          },
        ],
      },
      {
        path: "decisions",
        component: OfficeLayout,
        children: [
          { path: "", name: "decisions", component: DecisionsView },
          {
            path: ":id",
            name: "decision-detail",
            component: DecisionDetailView,
            props: true,
          },
        ],
      },
      {
        path: "automations",
        component: OfficeLayout,
        children: [
          { path: "", name: "automations", component: AutomationsView },
          {
            path: ":id",
            name: "automation-detail",
            component: AutomationDetailView,
            props: true,
          },
        ],
      },
      {
        path: "executions",
        component: OfficeLayout,
        children: [
          { path: "", name: "executions", component: ExecutionsView },
          {
            path: ":id",
            name: "execution-detail",
            component: ExecutionDetailView,
            props: true,
          },
        ],
      },
      {
        path: "workspaces",
        component: OfficeLayout,
        children: [
          { path: "", name: "workspaces", component: ProjectsView },
          {
            path: ":id",
            name: "workspace",
            component: WorkspaceRoom,
            props: true,
          },
        ],
      },
      {
        path: "team",
        component: OfficeLayout,
        children: [{ path: "", name: "team", component: EmployeeRoom }],
      },
      {
        path: "system",
        component: OfficeLayout,
        children: [
          { path: "infra", name: "vps-panel", component: VpsPanelView },
          { path: "settings", name: "settings", component: SettingsView },
        ],
      },
      {
        path: "office",
        component: OfficeLayout,
        children: [
          { path: "", name: "office", component: OfficeWorldPage },
          {
            path: "status",
            redirect: "/app/command",
          },
          { path: "sala-ceo", name: "ceo-room", component: ExecutiveRoom },
          { path: "equipe", redirect: "/app/team" },
          { path: "projetos", redirect: "/app/workspaces" },
          {
            path: "projetos/:id",
            redirect: (to) => `/app/workspaces/${String(to.params.id)}`,
          },
          { path: "missions", redirect: "/app/missions" },
          {
            path: "missions/:id",
            redirect: (to) => `/app/missions/${String(to.params.id)}`,
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
          { path: "vps", redirect: "/app/system/infra" },
          { path: "configuracoes", redirect: "/app/system/settings" },
          {
            path: "legacy-status",
            name: "office-status",
            component: OfficeStatusView,
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
