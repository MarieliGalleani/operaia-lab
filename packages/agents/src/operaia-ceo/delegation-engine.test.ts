import { describe, expect, it } from "vitest";
import { Specialization } from "@operaia/employee-framework";
import {
  DelegationEngine,
  parseDelegationContextFromObjective,
} from "./delegation-engine.js";
import { matchDelegationPattern } from "./delegation-matrix.js";

describe("delegation-matrix patterns", () => {
  it("casa globs principais", () => {
    expect(matchDelegationPattern("apps/api/src/x.ts", "apps/api/**")).toBe(
      true,
    );
    expect(matchDelegationPattern("apps/web/App.vue", "*.vue")).toBe(true);
    expect(matchDelegationPattern("infra/k8s/app.yaml", "*.yaml")).toBe(true);
    expect(matchDelegationPattern("README.md", "README")).toBe(true);
    expect(matchDelegationPattern("docs/a.md", "docs/**")).toBe(true);
  });
});

describe("DelegationEngine", () => {
  const engine = new DelegationEngine();

  it("Backend → Mag (SOFTWARE_ENGINEERING)", () => {
    const result = engine.validate(
      engine.recommend({
        objective: "revisar mudanca",
        affectedFiles: ["apps/api/src/modules/runtime/foo.ts", "packages/agents/src/x.ts"],
      }),
    );
    expect(result.specializations).toEqual([
      Specialization.SOFTWARE_ENGINEERING,
    ]);
  });

  it("Frontend → Luna + Mag", () => {
    const result = engine.validate(
      engine.recommend({
        objective: "ui",
        affectedFiles: ["apps/web/src/App.vue", "apps/web/src/styles.css"],
      }),
    );
    expect(result.specializations).toEqual(
      expect.arrayContaining([
        Specialization.PRODUCT_DESIGN,
        Specialization.SOFTWARE_ENGINEERING,
      ]),
    );
    expect(result.specializations).toHaveLength(2);
  });

  it("Infra → Atlas (AUTOMATION)", () => {
    const result = engine.validate(
      engine.recommend({
        objective: "infra",
        affectedFiles: ["infra/caddy/Caddyfile", "docker-compose.yml"],
      }),
    );
    expect(result.specializations).toContain(Specialization.AUTOMATION);
  });

  it("Juridico → Themis (LEGAL)", () => {
    const result = engine.validate(
      engine.recommend({
        objective: "legal",
        affectedFiles: ["legal/terms.md", "privacy/policy.md"],
      }),
    );
    expect(result.specializations).toEqual([Specialization.LEGAL]);
  });

  it("Marketing → Mercurio (MARKETING)", () => {
    const result = engine.validate(
      engine.recommend({
        objective: "campaign",
        affectedFiles: ["marketing/campaign.md", "landing/index.html"],
      }),
    );
    expect(result.specializations).toEqual([Specialization.MARKETING]);
  });

  it("README/docs only → IGNORE", () => {
    const result = engine.recommend({
      objective: "docs",
      affectedFiles: ["README.md", "docs/guide.md"],
    });
    expect(result.ignored).toBe(true);
    expect(result.delegations).toHaveLength(0);
  });

  it("multiplos especialistas na mesma missao (api + legal)", () => {
    const result = engine.validate(
      engine.recommend({
        objective: "multi",
        affectedFiles: [
          "apps/api/src/server.ts",
          "legal/contracts/msa.md",
          "marketing/landing.md",
        ],
      }),
    );
    expect(result.specializations).toEqual(
      expect.arrayContaining([
        Specialization.SOFTWARE_ENGINEERING,
        Specialization.LEGAL,
        Specialization.MARKETING,
      ]),
    );
    expect(result.delegations.length).toBeGreaterThanOrEqual(3);
  });

  it("parseia contexto do objective SIGNAL", () => {
    const ctx = parseDelegationContextFromObjective(
      "[COORDINATE/SIGNAL] github.repo.snapshot.changed · workspace=nexo · " +
        "repository=acme/nexo · mudanca=lastCommitSha · " +
        "arquivos=apps/api/src/a.ts, package.json · motivo=technical_file_change · source=sha",
    );
    expect(ctx.workspaceId).toBe("nexo");
    expect(ctx.repository).toBe("acme/nexo");
    expect(ctx.changeReason).toBe("technical_file_change");
    expect(ctx.affectedFiles).toEqual([
      "apps/api/src/a.ts",
      "package.json",
    ]);

    const result = engine.validate(engine.recommend(ctx));
    expect(result.delegations.length).toBeGreaterThan(0);
    expect(result.specializations).toContain(
      Specialization.SOFTWARE_ENGINEERING,
    );
  });
});
