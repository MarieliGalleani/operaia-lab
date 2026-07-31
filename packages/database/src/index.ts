export { prisma } from "./client.js";
export type { Database } from "./client.js";

// Re-exporta tipos e enums gerados pelo Prisma para consumo tipado nos modulos.
export {
  type Project,
  type Task,
  type Agent,
  type Mission,
  type MissionEvent,
  type WorkerHeartbeat,
  type ScheduleRule,
  type OrganizationalGoal,
  type MissionLearning,
  type MissionDependency,
  type ChangeProposal,
  type DomainSignal,
  type WorkspaceSourceBinding,
  type WorkspaceGithubSnapshot,
  type ActionExecution,
  MissionStatus,
  MissionKind,
  MissionReadiness,
  GoalStatus,
  ApprovalStatus,
  DomainSignalStatus,
  DomainSignalEvaluationDecision,
  ActionExecutionStatus,
  Prisma,
} from "@prisma/client";
