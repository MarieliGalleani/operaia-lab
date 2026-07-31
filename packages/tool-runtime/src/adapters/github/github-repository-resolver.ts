/**
 * Resolve owner/repo a partir do Workspace (WorkspaceSourceBinding).
 * Employee nunca informa o repositorio.
 */
export interface GithubRepositoryResolver {
  resolveRepository(workspaceId: string): Promise<string | null>;
}

export class StaticGithubRepositoryResolver
  implements GithubRepositoryResolver
{
  constructor(private readonly repositoryByWorkspace: ReadonlyMap<string, string>) {}

  async resolveRepository(workspaceId: string): Promise<string | null> {
    return this.repositoryByWorkspace.get(workspaceId) ?? null;
  }
}

export class FixedGithubRepositoryResolver
  implements GithubRepositoryResolver
{
  constructor(private readonly repository: string) {}

  async resolveRepository(_workspaceId: string): Promise<string | null> {
    return this.repository;
  }
}
