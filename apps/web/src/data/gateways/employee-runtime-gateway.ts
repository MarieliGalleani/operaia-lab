import type {
  EmployeeReplyDTO,
  EmployeeStatusDTO,
  WorkflowDTO,
} from "@/data/dto";

/**
 * Porta para o **Employee Runtime** (Employee Activation Layer): situação
 * operacional dos funcionários, execução de pedidos (ex.: CEO no chat) e o
 * fluxo de delegação em andamento em um Workspace.
 */
export interface EmployeeRuntimeGateway {
  getStatuses(): Promise<readonly EmployeeStatusDTO[]>;
  ask(
    employeeId: string,
    workspaceId: string | null,
    question: string,
  ): Promise<EmployeeReplyDTO>;
  getWorkflow(workspaceId: string): Promise<WorkflowDTO | undefined>;
}
