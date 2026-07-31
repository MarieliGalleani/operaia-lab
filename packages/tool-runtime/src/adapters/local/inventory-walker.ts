/**
 * Descoberta de artefatos de infraestrutura sob o root do workspace.
 */
import type { InfrastructureFileSystem } from "./infrastructure-fs.js";
import {
  isAllowedWalkDir,
  isCaddyfileName,
  isDockerComposeName,
  isDockerfileName,
  isWhitelistedRelativePath,
  isWorkflowRelativePath,
} from "./path-whitelist.js";

export type InfrastructureFindBuckets = {
  dockerfiles: string[];
  dockerComposes: string[];
  workflows: string[];
  caddyfiles: string[];
};

export async function walkInfrastructureInventory(input: {
  readonly fs: InfrastructureFileSystem;
  readonly workspaceRoot: string;
  readonly relativeDir: string;
  readonly depth: number;
  readonly found: InfrastructureFindBuckets;
}): Promise<void> {
  const { fs, workspaceRoot, relativeDir, depth, found } = input;
  if (depth > 8) {
    return;
  }
  if (relativeDir && !isAllowedWalkDir(relativeDir)) {
    return;
  }

  const absDir = relativeDir
    ? `${workspaceRoot}/${relativeDir}`
    : workspaceRoot;
  let entries;
  try {
    entries = await fs.readdir(absDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const relative = relativeDir
      ? `${relativeDir}/${entry.name}`
      : entry.name;

    if (entry.isDirectory) {
      if (isAllowedWalkDir(relative)) {
        await walkInfrastructureInventory({
          fs,
          workspaceRoot,
          relativeDir: relative,
          depth: depth + 1,
          found,
        });
      }
      continue;
    }

    if (!isWhitelistedRelativePath(relative)) {
      continue;
    }
    if (isDockerfileName(entry.name)) {
      found.dockerfiles.push(relative);
    } else if (isDockerComposeName(entry.name)) {
      found.dockerComposes.push(relative);
    } else if (isCaddyfileName(entry.name)) {
      found.caddyfiles.push(relative);
    } else if (
      isWorkflowRelativePath(relative) &&
      (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))
    ) {
      found.workflows.push(relative);
    }
  }
}
