import { Priority, ProjectStatus } from "@operaia/shared";
import {
  DomainSignalService,
  InMemoryDomainSignalStore,
} from "@operaia/domain-signals";
import { describe, expect, it } from "vitest";
import type { Project } from "./domain/project.entity.js";
import type {
  CreateProjectInput,
  ProjectRepository,
  UpdateProjectInput,
} from "./domain/project.repository.js";
import {
  assertOfficialSlugConsistency,
  ensureOfficialOperationalCatalog,
} from "./ensure-official-operational-catalog.js";
import {
  OFFICIAL_OPERATIONAL_WORKSPACES,
  canonicalGithubExternalRef,
} from "./official-operational-catalog.js";

class FakeProjectRepository implements ProjectRepository {
  private readonly rows = new Map<string, Project>();

  async create(input: CreateProjectInput): Promise<Project> {
    const now = new Date();
    const row: Project = {
      id: `proj-${this.rows.size + 1}`,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? ProjectStatus.PLANNED,
      priority: input.priority ?? Priority.MEDIUM,
      goalId: input.goalId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<Project | null> {
    return this.rows.get(id) ?? null;
  }

  async findByName(name: string): Promise<Project | null> {
    return [...this.rows.values()].find((row) => row.name === name) ?? null;
  }

  async findAll(): Promise<Project[]> {
    return [...this.rows.values()];
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const existing = this.rows.get(id);
    if (!existing) {
      throw new Error(`missing ${id}`);
    }
    const updated = { ...existing, ...input, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
}

describe("ensureOfficialOperationalCatalog", () => {
  it("slug map cobre os 8 workspaces oficiais", () => {
    expect(() => assertOfficialSlugConsistency()).not.toThrow();
    expect(OFFICIAL_OPERATIONAL_WORKSPACES).toHaveLength(8);
  });

  it("cria Projects + bindings e e idempotente", async () => {
    const projects = new FakeProjectRepository();
    const signals = new DomainSignalService(new InMemoryDomainSignalStore());

    const first = await ensureOfficialOperationalCatalog({
      projects,
      upsertBinding: (input) => signals.upsertBinding(input),
    });
    expect(first.projectsEnsured).toBe(8);
    expect(first.bindingsUpserted).toBe(8);
    expect(first.workspaceIds).toEqual(
      OFFICIAL_OPERATIONAL_WORKSPACES.map((e) => e.workspaceId),
    );

    const second = await ensureOfficialOperationalCatalog({
      projects,
      upsertBinding: (input) => signals.upsertBinding(input),
    });
    expect(second.projectsEnsured).toBe(8);
    expect(second.createdProjectIds).toHaveLength(0);

    const allProjects = await projects.findAll();
    expect(allProjects).toHaveLength(8);
    expect(allProjects.every((p) => p.status === ProjectStatus.ACTIVE)).toBe(
      true,
    );

    const bindings = await signals.listBindings({ enabledOnly: true });
    expect(bindings).toHaveLength(8);
    expect(
      bindings.every(
        (b) =>
          b.sourceType === "github" &&
          b.enabled &&
          b.externalRef === b.externalRef.toLowerCase(),
      ),
    ).toBe(true);

    const nexoBinding = bindings.find((b) => b.workspaceId === "nexo");
    expect(nexoBinding?.externalRef).toBe(
      canonicalGithubExternalRef("MarieliGalleani/operaia-core-nexo"),
    );
  });
});
