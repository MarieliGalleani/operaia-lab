import type { EmployeeRegistryGateway } from "./employee-registry-gateway";
import type { EmployeeRuntimeGateway } from "./employee-runtime-gateway";
import type { OrchestrationEventsGateway } from "./orchestration-events-gateway";
import type { SessionsGateway } from "./sessions-gateway";
import type { WorkspaceGateway } from "./workspace-gateway";

export type { EmployeeRegistryGateway } from "./employee-registry-gateway";
export type { EmployeeRuntimeGateway } from "./employee-runtime-gateway";
export type { OrchestrationEventsGateway } from "./orchestration-events-gateway";
export type { SessionsGateway } from "./sessions-gateway";
export type { WorkspaceGateway } from "./workspace-gateway";

/**
 * Conjunto de portas que o escritório precisa. A composição (mock ou HTTP)
 * fornece este bundle; o `CompositeOfficeService` depende apenas dele.
 */
export interface OfficeGateways {
  readonly workspaces: WorkspaceGateway;
  readonly registry: EmployeeRegistryGateway;
  readonly runtime: EmployeeRuntimeGateway;
  readonly sessions: SessionsGateway;
  readonly events: OrchestrationEventsGateway;
}
