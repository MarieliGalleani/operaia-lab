/**
 * Multi-workspace bootstrap + isolamento (sem privilegiar NEXO).
 */
import { Priority, ProjectStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import { InMemoryWorkspaceSource } from "../employees/in-memory-workspace-source.js";
import type { OfficeWorkspaceRecord } from "../employees/workspace-source.js";
import { publicWorkspaceId, toWorkspaceSlug } from "../employees/workspace-mappers.js";
import type { Project } from "./domain/project.entity.js";
import type {
  CreateProjectInput,
  ProjectRepository,
  UpdateProjectInput,
} from "./domain/project.repository.js";
import { ensureOperationalWorkspaces } from "./ensure-operational-workspaces.js";
import { WorkspaceScanner } from "../runtime/supervisor/workspace-scanner.js";
import type { MissionQueuePort, MissionView } from "../runtime/supervisor/ports.js";

class FakeProjectRepository implements ProjectRepository {
  private readonly rows = new Map<string, Project>();

  seed(project: Project): void {
    this.rows.set(project.id, project);
  }

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
    const updated: Project = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
}

describe("ensureOperationalWorkspaces — multi-workspace", () => {
  it("cria Projects ACTIVE a partir de varios binding workspaceIds", async () => {
    const projects = new FakeProjectRepository();
    const result = await ensureOperationalWorkspaces({
      projects,
      bindingWorkspaceIds: ["alpha", "beta", "alpha"],
    });
    expect(result.workspaceIds).toEqual(["alpha", "beta"]);
    expect(result.createdIds).toHaveLength(2);
    expect(result.ensured.every((p) => p.status === ProjectStatus.ACTIVE)).toBe(
      true,
    );
  });

  it("reativa Project existente pausado (compatibilidade workspace unico)", async () => {
    const projects = new FakeProjectRepository();
    const now = new Date();
    projects.seed({
      id: "uuid-nexo",
      name: "NEXO",
      description: null,
      status: ProjectStatus.PAUSED,
      priority: Priority.HIGH,
      goalId: null,
      createdAt: now,
      updatedAt: now,
    });
    const result = await ensureOperationalWorkspaces({
      projects,
      bindingWorkspaceIds: ["nexo"],
    });
    expect(result.workspaceIds).toEqual(["nexo"]);
    expect(result.activatedIds).toEqual(["uuid-nexo"]);
    expect(publicWorkspaceId(result.ensured[0]!)).toBe("nexo");
  });

  it("toWorkspaceSlug e generico (sem hardcode NEXO)", () => {
    expect(toWorkspaceSlug("OperaIA.lab")).toBe("operaia-lab");
    expect(toWorkspaceSlug("MenuFlow")).toBe("menuflow");
  });
});

describe("WorkspaceScanner — multi-workspace isolation", () => {
  it("percorre todos os workspaces sem privilegiar um unico", async () => {
    const catalog: OfficeWorkspaceRecord[] = [
      {
        id: "alpha",
        projectId: "p-alpha",
        name: "Alpha",
        objective: "A",
        status: "ACTIVE",
        progress: 0,
        teamIds: ["operaia-ceo"],
        tasks: [
          {
            id: "t1",
            title: "task-a",
            status: "TODO",
            impact: 3,
            urgency: 3,
          },
        ],
      },
      {
        id: "beta",
        projectId: "p-beta",
        name: "Beta",
        objective: "B",
        status: "ACTIVE",
        progress: 0,
        teamIds: ["operaia-ceo"],
        tasks: [],
      },
    ];
    const workspaces = new InMemoryWorkspaceSource(catalog);
    const missions: MissionView[] = [
      {
        id: "m1",
        workspaceId: "alpha",
        status: "QUEUED",
        readiness: "READY",
        attempt: 0,
        maxAttempts: 3,
        updatedAt: new Date(),
        startedAt: null,
        lastError: null,
        missionKind: "COORDINATE",
        ownerEmployeeId: "operaia-ceo",
      },
    ];
    const queue: MissionQueuePort = {
      async list() {
        return missions;
      },
      async enqueue() {
        return { created: true, id: "x" };
      },
      async depths() {
        return { queued: 1, running: 0, waiting: 0, failed: 0 };
      },
      async recoverStaleRunning() {
        return 0;
      },
      async recoverWaitingParents() {
        return 0;
      },
      async recoverBlockedDag() {
        return 0;
      },
      async recoverFailedRetryable() {
        return 0;
      },
    };
    const scanner = new WorkspaceScanner(workspaces, queue, {
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    const report = await scanner.scan();
    expect(report.workspaces).toHaveLength(2);
    expect(report.activeCount).toBe(2);
    const alpha = report.workspaces.find((w) => w.workspaceId === "alpha");
    const beta = report.workspaces.find((w) => w.workspaceId === "beta");
    expect(alpha?.hasReadyMission).toBe(true);
    expect(beta?.hasReadyMission).toBe(false);
    expect(beta?.openMissions).toBe(0);
  });
});
