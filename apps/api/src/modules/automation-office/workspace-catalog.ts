import { OFFICIAL_OPERATIONAL_WORKSPACES } from "../projects/official-operational-catalog.js";
import {
  ADMIN_OFFICIAL_WORKSPACE_IDS,
  isOfficialWorkspaceId,
  requireOfficialWorkspaceId,
} from "../auth/official-workspace-access.js";

const NAME_BY_ID = new Map(
  OFFICIAL_OPERATIONAL_WORKSPACES.map((workspace) => [
    workspace.workspaceId,
    workspace.name,
  ]),
);

const CLIENT_WORKSPACES = new Set([
  "nexo",
  "flowgrid",
  "hexalife",
  "odontoclinic",
  "estocai",
]);

export function resolveWorkspaceName(workspaceId: string): string {
  return NAME_BY_ID.get(workspaceId) ?? workspaceId;
}

export function resolveWorkspaceKind(
  workspaceId: string,
): "lab" | "client" {
  if (workspaceId === "operaia-lab" || workspaceId === "infra" || workspaceId === "deploy") {
    return "lab";
  }
  if (CLIENT_WORKSPACES.has(workspaceId)) {
    return "client";
  }
  return "client";
}

export function officialWorkspaceFilter(
  workspaceId?: string,
): { workspaceId: string } | { workspaceId: { in: string[] } } {
  if (workspaceId) {
    requireOfficialWorkspaceId(workspaceId);
    return { workspaceId };
  }
  return { workspaceId: { in: [...ADMIN_OFFICIAL_WORKSPACE_IDS] } };
}

export function assertOfficialWorkspace(workspaceId: string): string {
  if (!isOfficialWorkspaceId(workspaceId)) {
    requireOfficialWorkspaceId(workspaceId);
  }
  return workspaceId;
}
