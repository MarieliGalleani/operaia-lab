/**
 * Cliente tipado do Automation Office / Command Center (P0.3C-7).
 *
 * Contrato:
 * - VITE_OFFICE_COMMAND_MOCK=true → mock explícito (dev/testes).
 * - caso contrário → API real; erros HTTP/rede propagam (sem fallback silencioso).
 */
import { createHttpClient, type HttpClient } from "./http-client";
import type {
  ApprovalActionResponse,
  ApprovalDetailDto,
  ApprovalListItem,
  ApprovalStatus,
  AutonomyLevel,
  AutomationDto,
  AutomationListItem,
  CommandCenterDto,
  DecisionTraceDto,
  ExecuteDemandResponse,
  ExecutionDto,
  ExecutionListItem,
  InterpretDemandResponse,
  WorkspaceContextDto,
} from "../office-command";
import {
  mockApprovalDetail,
  mockApprovals,
  mockAutomation,
  mockAutomations,
  mockCommandCenter,
  mockDecisions,
  mockExecuteDemand,
  mockExecution,
  mockExecutions,
  mockInterpretDemand,
  mockWorkspaceContext,
} from "./office-command-mock";

export interface OfficeCommandClient {
  getCommandCenter(): Promise<CommandCenterDto>;
  interpretDemand(
    text: string,
    workspaceId: string,
    workspaceName: string,
  ): Promise<InterpretDemandResponse>;
  executeDemand(
    demandId: string,
    autonomy: AutonomyLevel,
  ): Promise<ExecuteDemandResponse>;
  listApprovals(workspaceId?: string): Promise<readonly ApprovalListItem[]>;
  getApproval(id: string): Promise<ApprovalDetailDto | null>;
  actOnApproval(
    id: string,
    action: "approve" | "reject" | "modify",
  ): Promise<ApprovalActionResponse>;
  listDecisions(workspaceId?: string): Promise<readonly DecisionTraceDto[]>;
  getDecision(id: string): Promise<DecisionTraceDto | null>;
  listAutomations(workspaceId?: string): Promise<readonly AutomationListItem[]>;
  getAutomation(id: string): Promise<AutomationDto | null>;
  listExecutions(workspaceId?: string): Promise<readonly ExecutionListItem[]>;
  getExecution(id: string): Promise<ExecutionDto | null>;
  getWorkspaceContext(
    workspaceId: string,
    fallbackName?: string,
  ): Promise<WorkspaceContextDto>;
  pendingApprovalsCount(): Promise<number>;
}

export interface OfficeCommandClientOptions {
  /** Override de teste; default lê VITE_OFFICE_COMMAND_MOCK. */
  readonly preferMock?: boolean;
}

/**
 * Mock só quando a flag é exatamente "true".
 * Omitido / "false" / qualquer outro valor → API real.
 */
export function isOfficeCommandMockEnabled(
  env: Record<string, string | undefined> = import.meta.env as Record<
    string,
    string | undefined
  >,
): boolean {
  return env.VITE_OFFICE_COMMAND_MOCK === "true";
}

export function createOfficeCommandClient(
  http: HttpClient = createHttpClient(),
  options: OfficeCommandClientOptions = {},
): OfficeCommandClient {
  const useMock = options.preferMock ?? isOfficeCommandMockEnabled();

  return {
    async getCommandCenter() {
      if (useMock) return mockCommandCenter();
      const command = await http.get<CommandCenterDto>("/office/command");
      return { ...command, source: "api", backendDependency: false };
    },

    async interpretDemand(text, workspaceId, workspaceName) {
      if (useMock) {
        return mockInterpretDemand(text, workspaceId, workspaceName);
      }
      const res = await http.post<InterpretDemandResponse>("/office/demands", {
        text,
        workspaceId,
      });
      return { ...res, source: "api", backendDependency: false };
    },

    async executeDemand(demandId, autonomy) {
      if (useMock) return mockExecuteDemand(demandId);
      const res = await http.post<ExecuteDemandResponse>(
        `/office/demands/${demandId}/execute`,
        { autonomy },
      );
      return { ...res, source: "api", backendDependency: false };
    },

    async listApprovals(workspaceId) {
      if (useMock) return mockApprovals();
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
      return http.get<readonly ApprovalListItem[]>(`/office/approvals${qs}`);
    },

    async getApproval(id) {
      if (useMock) return mockApprovalDetail(id);
      return http.get<ApprovalDetailDto>(`/office/approvals/${id}`);
    },

    async actOnApproval(id, action) {
      if (useMock) {
        const statusMap: Record<"approve" | "reject" | "modify", ApprovalStatus> =
          {
            approve: "APPROVED",
            reject: "REJECTED",
            modify: "MODIFIED",
          };
        return {
          source: "mock-temporary",
          backendDependency: true,
          status: statusMap[action],
          message:
            "MOCK explícito (VITE_OFFICE_COMMAND_MOCK=true) — nenhuma execução real.",
        };
      }
      return http.post<ApprovalActionResponse>(
        `/office/approvals/${id}/${action}`,
        {},
      );
    },

    async listDecisions(workspaceId) {
      if (useMock) return mockDecisions();
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
      return http.get<readonly DecisionTraceDto[]>(`/office/decisions${qs}`);
    },

    async getDecision(id) {
      if (useMock) {
        return mockDecisions().find((d) => d.decisionId === id) ?? null;
      }
      return http.get<DecisionTraceDto>(`/office/decisions/${id}`);
    },

    async listAutomations(workspaceId) {
      if (useMock) return mockAutomations();
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
      return http.get<readonly AutomationListItem[]>(`/office/automations${qs}`);
    },

    async getAutomation(id) {
      if (useMock) return mockAutomation(id);
      return http.get<AutomationDto>(`/office/automations/${id}`);
    },

    async listExecutions(workspaceId) {
      if (useMock) return mockExecutions();
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
      return http.get<readonly ExecutionListItem[]>(`/office/executions${qs}`);
    },

    async getExecution(id) {
      if (useMock) return mockExecution(id);
      return http.get<ExecutionDto>(`/office/executions/${id}`);
    },

    async getWorkspaceContext(workspaceId, fallbackName = workspaceId) {
      if (useMock) {
        return mockWorkspaceContext(workspaceId, fallbackName);
      }
      return http.get<WorkspaceContextDto>(
        `/office/workspaces/${workspaceId}/context`,
      );
    },

    async pendingApprovalsCount() {
      const list = await this.listApprovals();
      return list.filter((a) => a.status === "PENDING").length;
    },
  };
}

export const officeCommandClient = createOfficeCommandClient();
