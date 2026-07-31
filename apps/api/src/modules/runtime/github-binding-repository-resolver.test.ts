import { describe, expect, it } from "vitest";
import {
  DomainSignalService,
  GITHUB_SOURCE_TYPE,
  InMemoryDomainSignalStore,
} from "@operaia/domain-signals";
import { createBindingGithubRepositoryResolver } from "./github-binding-repository-resolver.js";

describe("createBindingGithubRepositoryResolver", () => {
  it("resolve o repositorio correto do workspace via binding", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    await signals.upsertBinding({
      workspaceId: "nexo",
      sourceType: GITHUB_SOURCE_TYPE,
      externalRef: "MarieliGalleani/operaia-core-nexo",
      enabled: true,
    });
    await signals.upsertBinding({
      workspaceId: "flowgrid",
      sourceType: GITHUB_SOURCE_TYPE,
      externalRef: "MarieliGalleani/flowgrid",
      enabled: true,
    });

    const resolver = createBindingGithubRepositoryResolver(signals);
    expect(await resolver.resolveRepository("nexo")).toBe(
      "marieligalleani/operaia-core-nexo",
    );
    expect(await resolver.resolveRepository("flowgrid")).toBe(
      "marieligalleani/flowgrid",
    );
    expect(await resolver.resolveRepository("missing")).toBeNull();
  });
});
