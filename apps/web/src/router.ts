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
import OperationalShellLayout from "@/layouts/OperationalShellLayout.vue";
import TodayView from "@/views/shell/TodayView.vue";
import PortariaView from "@/views/shell/PortariaView.vue";
import Office3DView from "@/views/shell/Office3DView.vue";
import SignalsView from "@/views/shell/SignalsView.vue";
import MarketingWorkView from "@/views/shell/MarketingWorkView.vue";
import AutomationWorkView from "@/views/shell/AutomationWorkView.vue";
import WorkView from "@/views/shell/WorkView.vue";
import InfraView from "@/views/shell/InfraView.vue";
import SalaOperaView from "@/views/shell/SalaOperaView.vue";
import KnowledgeShellView from "@/views/shell/KnowledgeShellView.vue";
import NotFoundShellView from "@/views/shell/NotFoundShellView.vue";
import LoginView from "@/views/LoginView.vue";
import CampusWorldPage from "@/views/CampusWorldPage.vue";
import WorkspaceRoom from "@/views/WorkspaceRoom.vue";
import NewProjectView from "@/views/NewProjectView.vue";
import EmployeeDetailView from "@/views/EmployeeDetailView.vue";
import SettingsView from "@/views/SettingsView.vue";
import MissionsView from "@/views/MissionsView.vue";
import MissionDetailView from "@/views/MissionDetailView.vue";
import NewDemandView from "@/views/command-center/NewDemandView.vue";
import ApprovalsView from "@/views/command-center/ApprovalsView.vue";
import ApprovalDetailView from "@/views/command-center/ApprovalDetailView.vue";
import DecisionsView from "@/views/decisions/DecisionsView.vue";
import DecisionDetailView from "@/views/decisions/DecisionDetailView.vue";
import AutomationDetailView from "@/views/automations/AutomationDetailView.vue";
import ExecutionsView from "@/views/executions/ExecutionsView.vue";
import ExecutionDetailView from "@/views/executions/ExecutionDetailView.vue";
import ScheduleRulesView from "@/views/system/ScheduleRulesView.vue";
import StoreFlowReviewView from "@/views/store-flow/StoreFlowReviewView.vue";
import StoreFlowDashboardView from "@/views/store-flow/StoreFlowDashboardView.vue";

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
      { path: "", redirect: "/app/portaria" },
      // ---- Terreo — Portaria (Interface 3.0) -------------------------------
      {
        path: "portaria",
        component: OperationalShellLayout,
        children: [
          { path: "", name: "portaria", component: PortariaView },
          { path: "office", name: "portaria-office", component: Office3DView, props: { floorId: "portaria" } },
          { path: "sala-opera", name: "ceo-room", component: SalaOperaView },
        ],
      },
      {
        path: "campus",
        component: OperationalShellLayout,
        children: [
          { path: "", name: "campus", component: CampusWorldPage },
        ],
      },
      // ---- 1º andar — Desenvolvimento ------------------------------------
      {
        path: "floor/dev",
        component: OperationalShellLayout,
        children: [
          { path: "", redirect: "/app/floor/dev/command" },
          { path: "office", name: "dev-office", component: Office3DView, props: { floorId: "dev" } },
          // /work nao existia no 1º andar (os trabalhos sao os workspaces).
          { path: "work", redirect: "/app/floor/dev/workspaces" },
          {
            path: "command",
            component: RouterView,
            children: [
              { path: "", name: "command", component: TodayView },
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
          { path: "signals", name: "signals", component: SignalsView },
          {
            path: "missions",
            component: RouterView,
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
            component: RouterView,
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
            path: "executions",
            component: RouterView,
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
            component: RouterView,
            children: [
              { path: "", name: "workspaces", component: WorkView },
              { path: "new", name: "workspace-new", component: NewProjectView },
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
            component: RouterView,
            children: [
              // Equipe agora vive no Escritorio 3D (Interface 3.0).
              { path: "", name: "team", redirect: "/app/floor/dev/office" },
              {
                path: ":employeeId",
                name: "employee-detail",
                component: EmployeeDetailView,
                props: true,
              },
            ],
          },
        ],
      },
      // ---- 2º andar — Automação -------------------------------------------
      {
        path: "floor/automation",
        component: OperationalShellLayout,
        children: [
          { path: "", redirect: "/app/floor/automation/command" },
          { path: "office", name: "automation-office", component: Office3DView, props: { floorId: "automation" } },
          {
            path: "command",
            name: "automation-command",
            component: TodayView,
          },
          {
            path: "signals",
            name: "automation-signals",
            component: SignalsView,
          },
          {
            path: "automations",
            component: RouterView,
            children: [
              { path: "", name: "automations", component: WorkView },
              {
                path: ":id",
                name: "automation-detail",
                component: AutomationDetailView,
                props: true,
              },
            ],
          },
          {
            path: "triggers",
            name: "schedule-rules",
            component: ScheduleRulesView,
          },
          {
            path: "clients",
            name: "automation-clients",
            component: AutomationWorkView,
          },
          {
            path: "team",
            component: RouterView,
            children: [
              // Equipe agora vive no Escritorio 3D (Interface 3.0).
              { path: "", name: "automation-team", redirect: "/app/floor/automation/office" },
              {
                path: ":employeeId",
                name: "automation-employee-detail",
                component: EmployeeDetailView,
                props: true,
              },
            ],
          },
        ],
      },
      // ---- 3º andar — Marketing (P1.21: existe na nav, sem dado real) ----
      {
        path: "floor/marketing",
        component: OperationalShellLayout,
        children: [
          { path: "", redirect: "/app/floor/marketing/command" },
          { path: "office", name: "marketing-office", component: Office3DView, props: { floorId: "marketing" } },
          {
            path: "command",
            name: "marketing-command",
            component: TodayView,
          },
          {
            path: "work",
            name: "marketing-work",
            component: MarketingWorkView,
          },
          {
            path: "team",
            component: RouterView,
            children: [
              // Equipe agora vive no Escritorio 3D (Interface 3.0).
              { path: "", name: "marketing-team", redirect: "/app/floor/marketing/office" },
              {
                path: ":employeeId",
                name: "marketing-employee-detail",
                component: EmployeeDetailView,
                props: true,
              },
            ],
          },
          {
            path: "signals",
            name: "marketing-signals",
            component: SignalsView,
          },
        ],
      },
      // ---- Transversal: Sistema, mundo 3D ---------------------------------
      {
        path: "system",
        component: OperationalShellLayout,
        children: [
          { path: "infra", name: "vps-panel", component: InfraView },
          { path: "settings", name: "settings", component: SettingsView },
          { path: "knowledge", name: "knowledge", component: KnowledgeShellView },
        ],
      },
      // ---- 4º andar — Store Flow (afiliados; elenco proprio: Flow + Driele) ----
      {
        path: "floor/store-flow",
        component: OperationalShellLayout,
        children: [
          { path: "", redirect: "/app/floor/store-flow/command" },
          { path: "office", name: "store-flow-office", component: Office3DView, props: { floorId: "store-flow" } },
          { path: "command", name: "store-flow", component: StoreFlowDashboardView },
          { path: "work", name: "store-flow-review", component: StoreFlowReviewView },
          { path: "team", name: "store-flow-team", redirect: "/app/floor/store-flow/office" },
          { path: "signals", name: "store-flow-signals", component: SignalsView },
        ],
      },
      // Enderecos antigos do Store Flow -> 4º andar
      { path: "store-flow", redirect: "/app/floor/store-flow/command" },
      { path: "store-flow/aprovacao", redirect: "/app/floor/store-flow/work" },
      // ---- Layout antigo (OfficeLayout) aposentado: tudo vive no shell 3.0.
      // Enderecos antigos continuam funcionando por redirecionamento.
      { path: "office", redirect: "/app/portaria" },
      { path: "office/status", redirect: "/app/floor/dev/command" },
      { path: "office/legacy-status", redirect: "/app/portaria" },
      { path: "office/sala-ceo", redirect: "/app/portaria/sala-opera" },
      { path: "office/equipe", redirect: "/app/floor/dev/office" },
      { path: "office/projetos", redirect: "/app/floor/dev/workspaces" },
      {
        path: "office/projetos/:id",
        redirect: (to) => `/app/floor/dev/workspaces/${String(to.params.id)}`,
      },
      { path: "office/missions", redirect: "/app/floor/dev/missions" },
      {
        path: "office/missions/:id",
        redirect: (to) => `/app/floor/dev/missions/${String(to.params.id)}`,
      },
      // Atividades repetia Execucoes + Mural do Hoje.
      { path: "office/atividades", redirect: "/app/floor/dev/executions" },
      { path: "office/conhecimento", redirect: "/app/system/knowledge" },
      { path: "office/vps", redirect: "/app/system/infra" },
      { path: "office/configuracoes", redirect: "/app/system/settings" },
      { path: "virtual-world-test", redirect: "/app/portaria" },
      // ---- Compatibilidade: rotas antigas -> andar correspondente --------
      { path: "command", redirect: "/app/floor/dev/command" },
      { path: "command/new", redirect: "/app/floor/dev/command/new" },
      {
        path: "command/approvals",
        redirect: "/app/floor/dev/command/approvals",
      },
      {
        path: "command/approvals/:id",
        redirect: (to) =>
          `/app/floor/dev/command/approvals/${String(to.params.id)}`,
      },
      { path: "missions", redirect: "/app/floor/dev/missions" },
      {
        path: "missions/:id",
        redirect: (to) => `/app/floor/dev/missions/${String(to.params.id)}`,
      },
      { path: "decisions", redirect: "/app/floor/dev/decisions" },
      {
        path: "decisions/:id",
        redirect: (to) => `/app/floor/dev/decisions/${String(to.params.id)}`,
      },
      { path: "executions", redirect: "/app/floor/dev/executions" },
      {
        path: "executions/:id",
        redirect: (to) => `/app/floor/dev/executions/${String(to.params.id)}`,
      },
      { path: "workspaces", redirect: "/app/floor/dev/workspaces" },
      {
        path: "workspaces/:id",
        redirect: (to) => `/app/floor/dev/workspaces/${String(to.params.id)}`,
      },
      { path: "team", redirect: "/app/floor/dev/team" },
      { path: "automations", redirect: "/app/floor/automation/automations" },
      {
        path: "automations/:id",
        redirect: (to) =>
          `/app/floor/automation/automations/${String(to.params.id)}`,
      },
      {
        path: "system/schedule-rules",
        redirect: "/app/floor/automation/triggers",
      },
      // ---- P1.14A: rotas antigas sem capacidade real correspondente ------
      { path: "tasks", redirect: "/app/floor/dev/workspaces" },
      { path: "vault", redirect: "/app/system/knowledge" },
      { path: "notes", redirect: "/app/system/knowledge" },
      // Catch-all dentro de /app: qualquer rota não mapeada cai aqui,
      // nunca em tela branca silenciosa.
      { path: ":pathMatch(.*)*", component: OperationalShellLayout, children: [{ path: "", name: "not-found", component: NotFoundShellView }] },
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
  { path: "/virtual-world-test", redirect: "/app/portaria" },
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
