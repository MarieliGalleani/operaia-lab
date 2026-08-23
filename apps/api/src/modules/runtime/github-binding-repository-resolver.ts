/**
 * Resolve owner/repo via WorkspaceSourceBinding (sourceType=github).
 */
import { GITHUB_SOURCE_TYPE, type DomainSignalService } from "@operaia/domain-signals";
import type { GithubRepositoryResolver } from "@operaia/tool-runtime";

export const GITHUB_BINDING_OPERATIONAL_REF_KEY = "operationalRef";

export function readOperationalRefFromBindingConfig(
  configJson: Record<string, unknown> | null | undefined,
): string | null {
  const raw = configJson?.[GITHUB_BINDING_OPERATIONAL_REF_KEY];
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed || null;
}

function findGithubBinding(
  bindings: Awaited<ReturnType<DomainSignalService["listBindings"]>>,
  workspaceId: string,
) {
  return bindings.find(
    (binding) =>
      binding.workspaceId === workspaceId &&
      binding.sourceType === GITHUB_SOURCE_TYPE &&
      binding.enabled,
  );
}

export function createBindingGithubRepositoryResolver(
  signals: DomainSignalService,
): GithubRepositoryResolver {
  return {
    async resolveRepository(workspaceId: string): Promise<string | null> {
      const bindings = await signals.listBindings({ enabledOnly: true });
      const match = findGithubBinding(bindings, workspaceId);
      return match?.externalRef?.trim().toLowerCase() || null;
    },
    async resolveOperationalRef(workspaceId: string): Promise<string | null> {
      const bindings = await signals.listBindings({ enabledOnly: true });
      const match = findGithubBinding(bindings, workspaceId);
      return readOperationalRefFromBindingConfig(match?.configJson ?? null);
    },
  };
}
