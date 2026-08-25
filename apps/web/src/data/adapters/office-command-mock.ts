/**
 * TEMPORÁRIO — mocks isolados para desbloquear UX P0.3D enquanto P0.3C não existe.
 * Remover quando endpoints /office/* estiverem disponíveis.
 * NÃO usar como sucesso real de operações críticas.
 */
import type {
  ApprovalDetailDto,
  ApprovalListItem,
  AutomationDto,
  AutomationListItem,
  CommandCenterDto,
  DecisionTraceDto,
  DemandBrief,
  ExecuteDemandResponse,
  ExecutionDto,
  ExecutionListItem,
  InterpretDemandResponse,
  WorkPlan,
  WorkspaceContextDto,
} from "../office-command";

const NOW = () => new Date().toISOString();

export function mockCommandCenter(): CommandCenterDto {
  return {
    generatedAt: NOW(),
    source: "mock-temporary",
    backendDependency: true,
    status: {
      level: "OPERATING",
      label: "OPERANDO",
      summary: "Escritório operacional. Dados de demonstração (P0.3C pendente).",
    },
    attention: [
      {
        id: "appr-demo-1",
        kind: "approval",
        severity: "critical",
        title: "Aprovação · Campanha para 14.238 contatos",
        detail: "Envio massivo externo — Clínica X",
        workspaceId: "clinica-x",
        workspaceName: "Clínica X",
        risk: "HIGH",
        href: "/app/command/approvals/appr-demo-1",
      },
    ],
    pendingApprovals: 1,
    inProgress: [
      {
        id: "work-demo-1",
        workspaceId: "clinica-x",
        workspaceName: "Clínica X",
        objective: "Automatizar onboarding de novos clientes",
        stepLabel: "Desenhar workflow",
        progressLabel: "Etapa 3/7",
        risk: "MEDIUM",
        href: "/app/missions",
      },
    ],
    decisions: [
      {
        id: "dec-demo-1",
        title: "Escolheu n8n + CRM para follow-up",
        rationale: "Menor complexidade + infraestrutura existente.",
        risk: "LOW",
        confidence: "HIGH",
        autonomy: "CONTROLLED",
        nextAction: "Construir workflow",
        createdAt: NOW(),
        workspaceName: "Clínica X",
      },
    ],
    completed: [
      {
        id: "done-demo-1",
        title: "Análise UX do funil de leads",
        finishedAt: NOW(),
        kind: "ux_analysis",
        href: "/app/missions",
        workspaceName: "Clínica X",
      },
    ],
    idle: false,
    zeroMessage:
      "Seu escritório está em dia. Pronto para receber uma nova demanda.",
  };
}

export function mockInterpretDemand(
  text: string,
  workspaceId: string,
  workspaceName: string,
): InterpretDemandResponse {
  const demandId = `demand-local-${Date.now()}`;
  const brief: DemandBrief = {
    demandId,
    workspaceId,
    workspaceName,
    objective: text.trim().slice(0, 200) || "Objetivo não informado",
    context: `Demanda registrada para ${workspaceName}.`,
    expectedOutcome: "Automação ou entrega estruturada alinhada ao objetivo.",
    constraints: ["Respeitar workspace", "Sem secrets em evidence"],
    priority: "MEDIUM",
    risk: "MEDIUM",
    autonomy: "CONTROLLED",
    dependencies: ["Integrações do workspace", "Credenciais configuradas"],
  };
  const plan: WorkPlan = {
    demandId,
    steps: [
      {
        id: "s1",
        title: "Mapear processo atual",
        assigneeEmployeeId: "nexus",
        assigneeLabel: "Nexus",
        dependencies: [],
        risk: "LOW",
        autonomy: "READ_PLAN",
        expectedResult: "Processo documentado",
      },
      {
        id: "s2",
        title: "Identificar entradas e sistemas",
        assigneeEmployeeId: "cto-mag",
        assigneeLabel: "Mag",
        dependencies: ["s1"],
        risk: "LOW",
        autonomy: "READ_PLAN",
        expectedResult: "Mapa de integrações",
      },
      {
        id: "s3",
        title: "Avaliar compliance",
        assigneeEmployeeId: "themis",
        assigneeLabel: "Themis",
        dependencies: ["s1"],
        risk: "MEDIUM",
        autonomy: "READ_PLAN",
        expectedResult: "Riscos legais listados",
      },
      {
        id: "s4",
        title: "Desenhar experiência",
        assigneeEmployeeId: "luna",
        assigneeLabel: "Luna",
        dependencies: ["s1"],
        risk: "LOW",
        autonomy: "READ_PLAN",
        expectedResult: "Fluxo UX proposto",
      },
      {
        id: "s5",
        title: "Construir automação",
        assigneeLabel: "Automation Office",
        dependencies: ["s2", "s3", "s4"],
        risk: "MEDIUM",
        autonomy: "CONTROLLED",
        expectedResult: "Workflow pronto",
      },
      {
        id: "s6",
        title: "Testar",
        assigneeLabel: "Automation Office",
        dependencies: ["s5"],
        risk: "MEDIUM",
        autonomy: "CONTROLLED",
        expectedResult: "Testes OK",
      },
      {
        id: "s7",
        title: "Ativar",
        assigneeLabel: "Automation Office",
        dependencies: ["s6"],
        risk: "HIGH",
        autonomy: "HUMAN_APPROVAL",
        expectedResult: "Automação ACTIVE",
      },
    ],
  };
  return {
    source: "mock-temporary",
    backendDependency: true,
    brief,
    plan,
  };
}

export function mockExecuteDemand(demandId: string): ExecuteDemandResponse {
  return {
    source: "mock-temporary",
    backendDependency: true,
    accepted: false,
    message:
      "BACKEND DEPENDENCY · P0.3C — execução real ainda não disponível. O plano foi preservado apenas na interface.",
    demandId,
    redirectTo: "/app/command",
  };
}

export function mockApprovals(): readonly ApprovalListItem[] {
  return [
    {
      id: "appr-demo-1",
      title: "Publicar campanha para 14.238 contatos",
      workspaceId: "clinica-x",
      workspaceName: "Clínica X",
      risk: "HIGH",
      status: "PENDING",
      createdAt: NOW(),
      actionSummary: "Envio massivo externo",
    },
  ];
}

export function mockApprovalDetail(id: string): ApprovalDetailDto | null {
  if (id !== "appr-demo-1") return null;
  return {
    id,
    workspaceId: "clinica-x",
    workspaceName: "Clínica X",
    action: "Publicar campanha para 14.238 contatos",
    risk: "HIGH",
    impact: "Comunicação externa em massa",
    reason: "Ultrapassa limiar de envio massivo do workspace.",
    planSummary: "Campanha de reativação · canal WhatsApp · lista validada",
    validated: ["Conteúdo revisado", "Lista deduplicada", "Horário permitido"],
    ifApprove: "Dispara execução e registra Decision Trace.",
    ifReject: "Pausa a automação e mantém status PAUSED.",
    officeDecision: "Executar somente após aprovação humana.",
    status: "PENDING",
    createdAt: NOW(),
  };
}

export function mockDecisions(): readonly DecisionTraceDto[] {
  return [
    {
      decisionId: "dec-demo-1",
      workspaceId: "clinica-x",
      workspaceName: "Clínica X",
      objective: "Automatizar follow-up de leads",
      context: "Lead → formulário → CRM → vendedor.",
      options: [
        { id: "A", label: "n8n + CRM" },
        { id: "B", label: "Código próprio" },
        { id: "C", label: "Plataforma externa" },
      ],
      chosenOptionId: "A",
      rationale: "Menor complexidade + infraestrutura existente.",
      risk: "LOW",
      confidence: "HIGH",
      autonomy: "CONTROLLED",
      impact: "Novo workflow no workspace Clínica X.",
      nextAction: "Construir workflow",
      responsibleEmployeeId: "operaia-ceo",
      responsibleLabel: "Automation Office",
      createdAt: NOW(),
    },
  ];
}

export function mockAutomations(): readonly AutomationListItem[] {
  return [
    {
      id: "auto-demo-1",
      name: "Onboarding novos clientes",
      objective: "Automatizar onboarding da Clínica X",
      workspaceId: "clinica-x",
      workspaceName: "Clínica X",
      status: "VALIDATING",
      triggerLabel: "Novo lead no formulário",
      autonomy: "CONTROLLED",
      risk: "MEDIUM",
      lastExecutionAt: NOW(),
      lastSuccess: true,
    },
    {
      id: "auto-demo-2",
      name: "Follow-up leads inativos",
      objective: "Recuperar leads sem resposta em 7 dias",
      workspaceId: "clinica-x",
      workspaceName: "Clínica X",
      status: "DRAFT",
      triggerLabel: "Agenda diária 09:00",
      autonomy: "HUMAN_APPROVAL",
      risk: "HIGH",
      lastExecutionAt: null,
      lastSuccess: null,
    },
  ];
}

export function mockAutomation(id: string): AutomationDto | null {
  const base = mockAutomations().find((a) => a.id === id);
  if (!base) return null;
  return {
    ...base,
    actions: ["Validar dados", "Atualizar CRM", "Notificar equipe"],
    nextExecutionAt: null,
    history: [
      {
        executionId: "exec-demo-1",
        at: NOW(),
        status: "WAITING_APPROVAL",
      },
    ],
  };
}

export function mockExecutions(): readonly ExecutionListItem[] {
  return [
    {
      id: "exec-demo-1",
      automationId: "auto-demo-1",
      automationName: "Onboarding novos clientes",
      workspaceId: "clinica-x",
      workspaceName: "Clínica X",
      status: "WAITING_APPROVAL",
      startedAt: NOW(),
      finishedAt: null,
    },
  ];
}

export function mockExecution(id: string): ExecutionDto | null {
  if (id !== "exec-demo-1") return null;
  return {
    id,
    automationId: "auto-demo-1",
    automationName: "Onboarding novos clientes",
    workspaceId: "clinica-x",
    workspaceName: "Clínica X",
    status: "WAITING_APPROVAL",
    startedAt: NOW(),
    finishedAt: null,
    triggerLabel: "Novo lead no formulário",
    steps: [
      {
        id: "e1",
        label: "Lead recebido",
        status: "ok",
        durationMs: 200,
        resultSummary: "Payload válido",
      },
      {
        id: "e2",
        label: "Validar dados",
        status: "ok",
        responsibleLabel: "Mag",
        durationMs: 1100,
        resultSummary: "Campos obrigatórios OK",
      },
      {
        id: "e3",
        label: "CRM",
        status: "ok",
        durationMs: 2400,
        resultSummary: "Contato criado",
      },
      {
        id: "e4",
        label: "Classificar lead",
        status: "ok",
        responsibleLabel: "Mercúrio",
        durationMs: 3000,
        resultSummary: "Score médio",
      },
      {
        id: "e5",
        label: "Aprovação humana",
        status: "waiting",
        resultSummary: "Aguardando aprovação",
        nextStepLabel: "Notificar vendedor",
      },
      {
        id: "e6",
        label: "Notificar vendedor",
        status: "pending",
      },
      {
        id: "e7",
        label: "Follow-up",
        status: "pending",
      },
    ],
  };
}

export function mockWorkspaceContext(
  workspaceId: string,
  name: string,
): WorkspaceContextDto {
  const isLab =
    workspaceId === "operaia-lab" ||
    workspaceId === "nexo" ||
    name.toLowerCase().includes("opera");
  return {
    workspaceId,
    name,
    kind: isLab ? "lab" : "client",
    statusLabel: "Operacional",
    automationsActive: isLab ? 0 : 1,
    missionsOpen: 0,
    decisionsRecent: isLab ? 0 : 1,
    approvalsPending: isLab ? 0 : 1,
    integrations: [
      { id: "github", label: "GitHub", configured: true },
      { id: "crm", label: "CRM", configured: !isLab },
      { id: "n8n", label: "n8n", configured: false },
    ],
    credentials: [
      { id: "crm-token", label: "CRM", configured: !isLab },
      { id: "whatsapp", label: "WhatsApp", configured: false },
    ],
  };
}
