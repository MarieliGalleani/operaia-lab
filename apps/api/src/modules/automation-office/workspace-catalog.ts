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

const KIND_BY_ID = new Map(
  OFFICIAL_OPERATIONAL_WORKSPACES.map((workspace) => [workspace.workspaceId, workspace.kind]),
);

export function resolveWorkspaceName(workspaceId: string): string {
  return NAME_BY_ID.get(workspaceId) ?? workspaceId;
}

export function resolveWorkspaceKind(
  workspaceId: string,
): "lab" | "client" {
  // Catalogo oficial e a fonte: sites e design contam como "client"
  // (trabalho de produto), so a estrutura do escritorio e "lab".
  return KIND_BY_ID.get(workspaceId) === "lab" ? "lab" : "client";
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
