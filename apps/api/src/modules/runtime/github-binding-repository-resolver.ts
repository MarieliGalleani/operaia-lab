/**
 * Resolve owner/repo via WorkspaceSourceBinding (sourceType=github).
 */
import { GITHUB_SOURCE_TYPE, type DomainSignalService } from "@operaia/domain-signals";
import type { GithubRepositoryResolver } from "@operaia/tool-runtime";

export function createBindingGithubRepositoryResolver(
  signals: DomainSignalService,
): GithubRepositoryResolver {
  return {
    async resolveRepository(workspaceId: string): Promise<string | null> {
      const bindings = await signals.listBindings({ enabledOnly: true });
      const match = bindings.find(
        (binding) =>
          binding.workspaceId === workspaceId &&
          binding.sourceType === GITHUB_SOURCE_TYPE &&
          binding.enabled,
      );
      return match?.externalRef?.trim().toLowerCase() || null;
    },
  };
}
