/**
 * Resolve o root local de infraestrutura por Workspace.
 * Cada workspace enxerga apenas o proprio root.
 */

export interface WorkspaceInfrastructureResolver {
  resolveRoot(workspaceId: string): Promise<string | null>;
}

/**
 * Mapa estatico workspaceId → absolute root.
 */
export class MapWorkspaceInfrastructureResolver
  implements WorkspaceInfrastructureResolver
{
  private readonly roots: Readonly<Record<string, string>>;

  constructor(roots: Readonly<Record<string, string>>) {
    const normalized: Record<string, string> = {};
    for (const [id, root] of Object.entries(roots)) {
      normalized[id] = normalizeRoot(root);
    }
    this.roots = normalized;
  }

  async resolveRoot(workspaceId: string): Promise<string | null> {
    return this.roots[workspaceId] ?? null;
  }
}

function normalizeRoot(root: string): string {
  const trimmed = root.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (trimmed.length > 1 && trimmed.endsWith("/")) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}
