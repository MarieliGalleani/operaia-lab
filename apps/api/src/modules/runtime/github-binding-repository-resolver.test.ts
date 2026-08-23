import { describe, expect, it } from "vitest";
import {
  DomainSignalService,
  GITHUB_SOURCE_TYPE,
  InMemoryDomainSignalStore,
} from "@operaia/domain-signals";
import {
  createBindingGithubRepositoryResolver,
  readOperationalRefFromBindingConfig,
} from "./github-binding-repository-resolver.js";

describe("readOperationalRefFromBindingConfig", () => {
  it("le operationalRef quando presente e valido", () => {
    expect(
      readOperationalRefFromBindingConfig({ operationalRef: "lab" }),
    ).toBe("lab");
  });

  it("retorna null quando ausente ou invalido", () => {
    expect(readOperationalRefFromBindingConfig(null)).toBeNull();
    expect(readOperationalRefFromBindingConfig({})).toBeNull();
    expect(readOperationalRefFromBindingConfig({ operationalRef: "  " })).toBeNull();
    expect(readOperationalRefFromBindingConfig({ operationalRef: 1 })).toBeNull();
  });
});

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

  it("resolve operationalRef do configJson quando configurado", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    await signals.upsertBinding({
      workspaceId: "operaia-lab",
      sourceType: GITHUB_SOURCE_TYPE,
      externalRef: "MarieliGalleani/operaia-lab",
      enabled: true,
      configJson: { operationalRef: "lab" },
    });
    await signals.upsertBinding({
      workspaceId: "nexo",
      sourceType: GITHUB_SOURCE_TYPE,
      externalRef: "MarieliGalleani/operaia-core-nexo",
      enabled: true,
    });

    const resolver = createBindingGithubRepositoryResolver(signals);
    expect(await resolver.resolveOperationalRef?.("operaia-lab")).toBe("lab");
    expect(await resolver.resolveOperationalRef?.("nexo")).toBeNull();
    expect(await resolver.resolveOperationalRef?.("missing")).toBeNull();
  });
});
