import { describe, expect, it } from "vitest";
import {
  decideGithubRepoSnapshotChanged,
  isReadmeOrDocsPath,
  isTechnicalPath,
} from "./github-snapshot-decision.js";

describe("github-snapshot-decision", () => {
  it("classifica paths tecnicos", () => {
    expect(isTechnicalPath("src/a.ts")).toBe(true);
    expect(isTechnicalPath("apps/api/src/x.ts")).toBe(true);
    expect(isTechnicalPath("package.json")).toBe(true);
    expect(isTechnicalPath("prisma/migrations/1/migration.sql")).toBe(true);
    expect(isTechnicalPath("README.md")).toBe(false);
  });

  it("classifica readme/docs", () => {
    expect(isReadmeOrDocsPath("README.md")).toBe(true);
    expect(isReadmeOrDocsPath("docs/architecture.md")).toBe(true);
    expect(isReadmeOrDocsPath("src/a.ts")).toBe(false);
  });

  it("sem impacto tecnico → IGNORE", () => {
    expect(
      decideGithubRepoSnapshotChanged({
        changeFields: ["primaryLanguage", "updatedAt"],
      }).reason,
    ).toBe("no_technical_impact");
  });
});
