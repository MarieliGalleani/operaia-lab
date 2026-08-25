import { prisma } from "@operaia/database";
import { NotFoundError } from "@operaia/shared";
import { countPendingApprovals } from "./approval.service.js";
import { countActiveAutomations } from "./automation.service.js";
import { countRecentDecisions } from "./decision-trace.service.js";
import { countOpenMissions } from "./execution-projection.service.js";
import {
  assertOfficialWorkspace,
  resolveWorkspaceKind,
  resolveWorkspaceName,
} from "./workspace-catalog.js";

const INTEGRATION_LABELS: Record<string, string> = {
  github: "GitHub",
  n8n: "n8n",
  http: "HTTP",
  internal: "Interno",
};

export async function getWorkspaceContext(workspaceId: string) {
  assertOfficialWorkspace(workspaceId);

  const name = resolveWorkspaceName(workspaceId);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    missionsOpen,
    automationsActive,
    decisionsRecent,
    approvalsPending,
    bindings,
  ] = await Promise.all([
    countOpenMissions(workspaceId),
    countActiveAutomations(workspaceId),
    countRecentDecisions(workspaceId, since),
    countPendingApprovals([workspaceId]),
    prisma.workspaceSourceBinding.findMany({
      where: { workspaceId, enabled: true },
      select: {
        id: true,
        sourceType: true,
        externalRef: true,
        secretRef: true,
      },
    }),
  ]);

  if (bindings.length === 0 && !resolveWorkspaceName(workspaceId)) {
    throw new NotFoundError("Workspace", workspaceId);
  }

  const integrations = bindings.map((binding) => ({
    id: binding.id,
    label:
      INTEGRATION_LABELS[binding.sourceType] ?? binding.sourceType,
    configured: true,
  }));

  const credentials = bindings.map((binding) => ({
    id: `${binding.id}-cred`,
    label: `${INTEGRATION_LABELS[binding.sourceType] ?? binding.sourceType} · ${binding.externalRef}`,
    configured: binding.secretRef != null && binding.secretRef.length > 0,
  }));

  const statusLabel =
    missionsOpen > 0
      ? `${missionsOpen} missão(ões) aberta(s)`
      : "Em dia";

  return {
    workspaceId,
    name,
    kind: resolveWorkspaceKind(workspaceId),
    statusLabel,
    automationsActive,
    missionsOpen,
    decisionsRecent,
    approvalsPending,
    integrations,
    credentials,
  };
}
