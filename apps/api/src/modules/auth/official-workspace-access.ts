import { DomainError } from "@operaia/shared";
import { OFFICIAL_OPERATIONAL_WORKSPACES } from "../projects/official-operational-catalog.js";
import type { AuthenticatedAdmin } from "./auth.types.js";

const OFFICIAL_WORKSPACE_IDS = new Set(
  OFFICIAL_OPERATIONAL_WORKSPACES.map((workspace) => workspace.workspaceId),
);
const OFFICIAL_WORKSPACE_NAMES = new Set(
  OFFICIAL_OPERATIONAL_WORKSPACES.map((workspace) => workspace.name),
);

export const ADMIN_OFFICIAL_WORKSPACE_IDS = Object.freeze(
  OFFICIAL_OPERATIONAL_WORKSPACES.map((workspace) => workspace.workspaceId),
);

export class WorkspaceAccessDeniedError extends DomainError {
  readonly code = "WORKSPACE_ACCESS_DENIED";
  readonly httpStatus = 403;
}

export function isOfficialWorkspaceId(workspaceId: string): boolean {
  return OFFICIAL_WORKSPACE_IDS.has(workspaceId);
}

export function isOfficialWorkspaceName(workspaceName: string): boolean {
  return OFFICIAL_WORKSPACE_NAMES.has(workspaceName);
}

export function requireOfficialWorkspaceId(workspaceId: string): string {
  if (!isOfficialWorkspaceId(workspaceId)) {
    throw new WorkspaceAccessDeniedError(
      `Workspace nao autorizado: ${workspaceId}`,
    );
  }
  return workspaceId;
}

export function hasOfficialWorkspaceAccess(
  admin: AuthenticatedAdmin,
  workspaceId: string,
): boolean {
  return admin.role === "ADMIN" && isOfficialWorkspaceId(workspaceId);
}

export function requireOfficialWorkspaceAccess(
  admin: AuthenticatedAdmin,
  workspaceId: string,
): string {
  if (admin.role !== "ADMIN") {
    throw new WorkspaceAccessDeniedError(
      `Workspace nao autorizado: ${workspaceId}`,
    );
  }
  return requireOfficialWorkspaceId(workspaceId);
}
