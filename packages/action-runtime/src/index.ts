/**
 * @operaia/action-runtime — camada segura de capacidade operacional (A.4).
 * Sem shell arbitrario; acoes tipadas + policy + ledger + adapters injetaveis.
 */

export {
  ActionId,
  ALL_ACTION_IDS,
  isKnownActionId,
  type ActionId as ActionIdType,
} from "./action-id.js";

export type { ActionRequest } from "./action-request.js";

export {
  actionOk,
  actionFail,
  type ActionResult,
  type ActionResultMetadata,
} from "./action-result.js";

export {
  ActionExecutionStatus,
  MapWorkspaceActionScope,
  type ActionAdapter,
  type ActionExecutionRecord,
  type WorkspaceActionScope,
} from "./action-types.js";

export {
  ActionCapabilityGroup,
  ACTION_GROUP_ACTIONS,
  DEFAULT_EMPLOYEE_ACTION_GROUPS,
  ActionPolicy,
  defaultActionPolicy,
  type ActionPolicyDecision,
  type ActionPolicyOptions,
} from "./action-policy.js";

export {
  InMemoryExecutionLedger,
  PrismaExecutionLedger,
  type ExecutionLedger,
  type CreateExecutionInput,
  type CompleteExecutionInput,
  type ExecutionStatusPatch,
  type ActionExecutionPrismaClient,
  type ActionExecutionPrismaDelegate,
  type ActionExecutionRow,
} from "./ledgers/index.js";

export {
  ActionExecutor,
  type ActionExecutorOptions,
} from "./action-executor.js";

export {
  ActionRuntime,
  createActionRuntime,
  type ActionRuntimeOptions,
} from "./action-runtime.js";

export {
  DockerActionAdapter,
  MemoryDockerActionClient,
  type DockerActionClient,
  type DockerServiceStatus,
  type DockerLogEntry,
} from "./adapters/docker/index.js";

export {
  SystemdActionAdapter,
  MemorySystemdActionClient,
  type SystemdActionClient,
  type SystemdUnitStatus,
} from "./adapters/systemd/index.js";

export {
  CaddyActionAdapter,
  MemoryCaddyActionClient,
  type CaddyActionClient,
  type CaddyValidateResult,
} from "./adapters/caddy/index.js";
