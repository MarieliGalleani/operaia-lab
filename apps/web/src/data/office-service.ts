import type {
  Activity,
  ChatMessage,
  Employee,
  OfficeSummary,
  Project,
  Task,
  Workflow,
} from "@/types/office";

/**
 * Contrato de acesso a dados do escritorio.
 *
 * A UI depende APENAS desta interface. Hoje existe uma implementacao mockada;
 * conectar a API real (Fastify + Workspace Runtime + Employee Registry) e
 * fornecer outra implementacao — nenhuma tela muda.
 */
export interface OfficeService {
  getEmployees(): Promise<readonly Employee[]>;
  getProjects(): Promise<readonly Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  getTasks(): Promise<readonly Task[]>;
  getTasksByProject(projectId: string): Promise<readonly Task[]>;
  getActivities(): Promise<readonly Activity[]>;
  getActivitiesByProject(projectId: string): Promise<readonly Activity[]>;
  getSummary(): Promise<OfficeSummary>;
  /** Fluxo de delegação em andamento de um Workspace (para o WorkflowViewer). */
  getWorkflow(workspaceId: string): Promise<Workflow | undefined>;
  /** Conversa com o CEO — Opera; retorna a mensagem de resposta executiva. */
  askCeo(question: string): Promise<ChatMessage>;
}
