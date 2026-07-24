import { buildCeoAnswer, renderCeoAnswer } from "@/data/ceo-responder";
import type {
  EmployeeProfileDTO,
  EmployeeReplyDTO,
  EmployeeStatusDTO,
  OrchestrationEventDTO,
  SessionDTO,
  SessionStateDTO,
  WorkflowDTO,
  WorkspaceDTO,
  WorkspaceTaskDTO,
} from "@/data/dto";
import type { OfficeGateways } from "@/data/gateways/office-gateways";
import { activities, projects, tasks } from "@/data/projects";

const LATENCY_MS = 120;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

/** Perfis do Employee Registry (espelha a Equipe Digital contratada). */
const mockProfiles: readonly EmployeeProfileDTO[] = [
  {
    id: "operaia-ceo",
    name: "Opera",
    role: "CEO",
    specialization: "MANAGEMENT",
    status: "WORKING",
    version: "1.0.0",
    executable: true,
    mission: "Coordenar o OperaIA.lab: analisar, priorizar, planejar e delegar.",
    capabilities: ["analisar workspace", "priorizar", "planejar", "delegar"],
    permissions: ["criar plano", "definir prioridades", "solicitar agentes"],
    limits: ["não escreve código", "não cria telas", "não executa automações"],
  },
  {
    id: "cto-mag",
    name: "Mag",
    role: "CTO",
    specialization: "SOFTWARE_ENGINEERING",
    status: "AVAILABLE",
    version: "1.0.0",
    executable: true,
    mission: "Garantir arquitetura sólida e desenvolvimento com qualidade.",
    capabilities: ["analisar arquitetura", "planos técnicos", "revisar código"],
    permissions: ["definir arquitetura", "priorizar tarefas técnicas"],
    limits: ["não decide comercial", "não faz marketing", "não define UX final"],
  },
  {
    id: "luna",
    name: "Luna",
    role: "Product Designer",
    specialization: "PRODUCT_DESIGN",
    status: "AVAILABLE",
    version: "1.0.0",
    executable: true,
    mission: "Tornar cada produto claro, desejável e fácil de usar.",
    capabilities: ["analisar jornadas", "propor plano de design"],
    permissions: ["analisar briefing", "propor plano do dominio"],
    limits: ["não escolhe funcionários por nome"],
  },
  {
    id: "nexus",
    name: "Nexus",
    role: "Product Manager",
    specialization: "PRODUCT_MANAGEMENT",
    status: "AVAILABLE",
    version: "1.0.0",
    executable: true,
    mission: "Traduzir objetivos de negócio em produto e roadmap.",
    capabilities: ["analisar produto", "propor roadmap"],
    permissions: ["analisar briefing", "propor plano do dominio"],
    limits: ["não escolhe funcionários por nome"],
  },
  {
    id: "atlas",
    name: "Atlas",
    role: "Automation Specialist",
    specialization: "AUTOMATION",
    status: "AVAILABLE",
    version: "1.0.0",
    executable: true,
    mission: "Conectar sistemas e automatizar fluxos operacionais.",
    capabilities: ["analisar processos", "propor automações"],
    permissions: ["analisar briefing", "propor plano do dominio"],
    limits: ["não escolhe funcionários por nome"],
  },
  {
    id: "aurora",
    name: "Aurora",
    role: "Finance Lead",
    specialization: "FINANCE",
    status: "AVAILABLE",
    version: "1.0.0",
    executable: true,
    mission: "Cuidar da saúde financeira dos projetos.",
    capabilities: ["analisar custos", "propor plano financeiro"],
    permissions: ["analisar briefing", "propor plano do dominio"],
    limits: ["não escolhe funcionários por nome"],
  },
  {
    id: "themis",
    name: "Themis",
    role: "Legal Counsel",
    specialization: "LEGAL",
    status: "AVAILABLE",
    version: "1.0.0",
    executable: true,
    mission: "Proteger o escritório e garantir conformidade legal.",
    capabilities: ["analisar riscos jurídicos", "propor compliance"],
    permissions: ["analisar briefing", "propor plano do dominio"],
    limits: ["não escolhe funcionários por nome"],
  },
  {
    id: "mercurio",
    name: "Mercúrio",
    role: "Marketing Lead",
    specialization: "MARKETING",
    status: "AVAILABLE",
    version: "1.0.0",
    executable: true,
    mission: "Levar cada produto ao público certo com a mensagem certa.",
    capabilities: ["analisar audiência", "propor plano de marketing"],
    permissions: ["analisar briefing", "propor plano do dominio"],
    limits: ["não escolhe funcionários por nome"],
  },
  {
    id: "orion",
    name: "Orion",
    role: "Operations Lead",
    specialization: "OPERATIONS",
    status: "AVAILABLE",
    version: "1.0.0",
    executable: true,
    mission: "Garantir operação diária eficiente e escalável.",
    capabilities: ["analisar fluxos", "propor melhorias de processo"],
    permissions: ["analisar briefing", "propor plano do dominio"],
    limits: ["não escolhe funcionários por nome"],
  },
];

const mockStatuses: readonly EmployeeStatusDTO[] = mockProfiles.map((profile) => ({
  employeeId: profile.id,
  status: profile.id === "operaia-ceo" ? "WORKING" : "AVAILABLE",
  statusLabel:
    profile.id === "operaia-ceo" ? "Coordenando projetos" : "Disponível",
  lastActivity:
    profile.id === "operaia-ceo"
      ? "Criou o plano da NEXO há 5 min"
      : "Aguardando missão no escritório",
}));

function toWorkspaceDTO(): readonly WorkspaceDTO[] {
  return projects.map((project) => ({ ...project }));
}

function toTaskDTOs(): readonly WorkspaceTaskDTO[] {
  return tasks.map((task) => ({
    id: task.id,
    workspaceId: task.projectId,
    title: task.title,
    status: task.status,
    assigneeId: task.assigneeId,
    priority: task.priority,
  }));
}

function toEventDTOs(): readonly OrchestrationEventDTO[] {
  return activities.map((activity) => ({
    id: activity.id,
    kind: activity.kind,
    actorId: activity.actorId,
    message: activity.message,
    timestamp: activity.timestamp,
    workspaceId: activity.projectId,
  }));
}

/** Fluxo de delegação da NEXO (CEO -> CTO -> resultado). */
const mockWorkflows: Record<string, WorkflowDTO> = {
  nexo: {
    workspaceId: "nexo",
    title: "Delegação técnica da NEXO",
    steps: [
      { stage: "THINKING", actorId: "operaia-ceo", detail: "Entendendo o objetivo", status: "done", timestamp: "2026-07-21T02:38:00-03:00" },
      { stage: "ANALYZING", actorId: "operaia-ceo", detail: "Análise do workspace", status: "done", timestamp: "2026-07-21T02:40:00-03:00" },
      { stage: "DELEGATING", actorId: "operaia-ceo", detail: "Solicitou Engenharia de Software", status: "done", timestamp: "2026-07-21T02:42:00-03:00" },
      { stage: "EXECUTING", actorId: "cto-mag", detail: "Plano técnico da NEXO", status: "current", timestamp: "2026-07-21T02:44:00-03:00" },
      { stage: "REVIEWING", actorId: "operaia-ceo", detail: "Revisão do resultado", status: "pending" },
      { stage: "DONE", actorId: "operaia-ceo", detail: "Relatório executivo", status: "pending" },
    ],
  },
};

/** Sessões criadas em memória durante a navegação. */
const sessions = new Map<string, SessionStateDTO>();

export function createMockGateways(): OfficeGateways {
  return {
    workspaces: {
      listWorkspaces: () => delay(toWorkspaceDTO()),
      getWorkspace: (id) =>
        delay(toWorkspaceDTO().find((workspace) => workspace.id === id)),
      listTasks: (workspaceId) =>
        delay(
          workspaceId
            ? toTaskDTOs().filter((task) => task.workspaceId === workspaceId)
            : toTaskDTOs(),
        ),
    },

    registry: {
      listProfiles: () => delay(mockProfiles),
      getProfile: (id) =>
        delay(mockProfiles.find((profile) => profile.id === id)),
    },

    runtime: {
      getStatuses: () => delay(mockStatuses),
      ask: (employeeId, _workspaceId, question) => {
        const answer = buildCeoAnswer(question, projects, tasks);
        const reply: EmployeeReplyDTO = {
          employeeId,
          content: renderCeoAnswer(answer),
          answer,
        };
        return delay(reply);
      },
      getWorkflow: (workspaceId) => delay(mockWorkflows[workspaceId]),
    },

    sessions: {
      startSession: (workspaceId, objective) => {
        const session: SessionStateDTO = {
          id: `session-${Date.now()}`,
          workspaceId,
          objective,
          status: "RUNNING",
          currentCycle: 1,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          executionSummary: null,
          history: [],
        };
        sessions.set(session.id, session);
        return delay(session as SessionDTO);
      },
      getSession: (workspaceId, sessionId) => {
        const existing = sessions.get(sessionId);
        const state: SessionStateDTO = existing ?? {
          id: sessionId,
          workspaceId,
          objective: "",
          status: "COMPLETED",
          currentCycle: 1,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          executionSummary: null,
          history: [],
        };
        return delay(state);
      },
      listSessions: (workspaceId) =>
        delay(
          [...sessions.values()].filter(
            (session) => session.workspaceId === workspaceId,
          ),
        ),
    },

    events: {
      listEvents: (workspaceId) =>
        delay(
          workspaceId
            ? toEventDTOs().filter((event) => event.workspaceId === workspaceId)
            : toEventDTOs(),
        ),
    },
  };
}
