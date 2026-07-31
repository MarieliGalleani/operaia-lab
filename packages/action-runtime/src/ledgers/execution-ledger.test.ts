import { describe, expect, it } from "vitest";
import { ActionId } from "../action-id.js";
import { ActionExecutionStatus as Status } from "../action-types.js";
import {
  InMemoryExecutionLedger,
  PrismaExecutionLedger,
  type ActionExecutionPrismaClient,
  type ActionExecutionRow,
  type ExecutionLedger,
} from "./index.js";

/**
 * Fake Prisma delegate — nenhum DB real nos testes.
 */
function createFakePrismaClient(): ActionExecutionPrismaClient & {
  readonly rows: Map<string, ActionExecutionRow>;
} {
  const rows = new Map<string, ActionExecutionRow>();

  return {
    rows,
    actionExecution: {
      async create({ data }) {
        const row: ActionExecutionRow = {
          id: data.id,
          workspaceId: data.workspaceId,
          employeeId: data.employeeId,
          actionId: data.actionId,
          target: data.target,
          status: data.status,
          requestedAt: data.requestedAt,
          startedAt: null,
          finishedAt: null,
          result: null,
          error: null,
        };
        rows.set(row.id, row);
        return row;
      },
      async update({ where, data }) {
        const current = rows.get(where.id);
        if (!current) {
          throw new Error(`not found: ${where.id}`);
        }
        const next: ActionExecutionRow = {
          ...current,
          status: data.status ?? current.status,
          startedAt:
            data.startedAt !== undefined ? data.startedAt : current.startedAt,
          finishedAt:
            data.finishedAt !== undefined
              ? data.finishedAt
              : current.finishedAt,
          result: data.result !== undefined ? data.result : current.result,
          error: data.error !== undefined ? data.error : current.error,
        };
        rows.set(where.id, next);
        return next;
      },
      async findUnique({ where }) {
        return rows.get(where.id) ?? null;
      },
      async findMany({ where }) {
        return [...rows.values()].filter((row) => {
          if (where.workspaceId && row.workspaceId !== where.workspaceId) {
            return false;
          }
          if (where.actionId && row.actionId !== where.actionId) {
            return false;
          }
          return true;
        });
      },
    },
  };
}

function assertLedgerContract(ledger: ExecutionLedger) {
  return ledger;
}

describe.each([
  ["InMemoryExecutionLedger", () => assertLedgerContract(new InMemoryExecutionLedger())],
  [
    "PrismaExecutionLedger",
    () => assertLedgerContract(new PrismaExecutionLedger(createFakePrismaClient())),
  ],
])("%s", (_name, createLedger) => {
  it("registra REQUESTED", async () => {
    const ledger = createLedger();
    const record = await ledger.createExecution({
      workspaceId: "operaia-lab",
      employeeId: "atlas",
      actionId: ActionId.dockerStatus,
      target: "api",
    });
    expect(record.status).toBe(Status.REQUESTED);
    expect(record.startedAt).toBeNull();
    expect(record.finishedAt).toBeNull();
    expect(record.target).toBe("api");

    const loaded = await ledger.getById(record.id);
    expect(loaded?.status).toBe(Status.REQUESTED);
  });

  it("atualiza RUNNING", async () => {
    const ledger = createLedger();
    const created = await ledger.createExecution({
      workspaceId: "operaia-lab",
      employeeId: "atlas",
      actionId: ActionId.dockerLogs,
      target: "api",
    });
    await ledger.updateExecutionStatus(created.id, Status.APPROVED);
    const running = await ledger.updateExecutionStatus(
      created.id,
      Status.RUNNING,
      { startedAt: "2026-07-31T15:00:00.000Z" },
    );
    expect(running.status).toBe(Status.RUNNING);
    expect(running.startedAt).toBe("2026-07-31T15:00:00.000Z");
  });

  it("registra SUCCESS via completeExecution", async () => {
    const ledger = createLedger();
    const created = await ledger.createExecution({
      workspaceId: "operaia-lab",
      employeeId: "atlas",
      actionId: ActionId.caddyValidate,
      target: "infra/caddy/Caddyfile",
    });
    await ledger.updateExecutionStatus(created.id, Status.RUNNING, {
      startedAt: new Date().toISOString(),
    });
    const done = await ledger.completeExecution(created.id, {
      status: Status.SUCCESS,
      result: { valid: true },
      error: null,
    });
    expect(done.status).toBe(Status.SUCCESS);
    expect(done.finishedAt).toBeTruthy();
    expect(done.result).toEqual({ valid: true });
    expect(done.error).toBeNull();
  });

  it("registra FAILED via completeExecution", async () => {
    const ledger = createLedger();
    const created = await ledger.create({
      workspaceId: "operaia-lab",
      employeeId: "atlas",
      actionId: ActionId.dockerRestart,
      target: "api",
    });
    const failed = await ledger.completeExecution(created.id, {
      status: Status.FAILED,
      error: "service unavailable",
    });
    expect(failed.status).toBe(Status.FAILED);
    expect(failed.error).toBe("service unavailable");
  });

  it("isolamento por workspaceId", async () => {
    const ledger = createLedger();
    await ledger.createExecution({
      workspaceId: "operaia-lab",
      employeeId: "atlas",
      actionId: ActionId.dockerStatus,
      target: "api",
    });
    await ledger.createExecution({
      workspaceId: "nexo",
      employeeId: "atlas",
      actionId: ActionId.dockerStatus,
      target: "nexo-api",
    });

    const lab = await ledger.findByWorkspace("operaia-lab");
    const nexo = await ledger.listByWorkspace("nexo");
    expect(lab).toHaveLength(1);
    expect(lab[0]?.workspaceId).toBe("operaia-lab");
    expect(nexo).toHaveLength(1);
    expect(nexo[0]?.workspaceId).toBe("nexo");

    const byAction = await ledger.findByAction(ActionId.dockerStatus, {
      workspaceId: "operaia-lab",
    });
    expect(byAction).toHaveLength(1);
    expect(byAction[0]?.target).toBe("api");
  });

  it("mantem aliases create/updateStatus/listByWorkspace", async () => {
    const ledger = createLedger();
    const created = await ledger.create({
      workspaceId: "operaia-lab",
      employeeId: "orion",
      actionId: ActionId.systemdStatus,
      target: "operaia-lab-api.service",
    });
    const updated = await ledger.updateStatus(created.id, Status.RUNNING, {
      startedAt: "2026-07-31T16:00:00.000Z",
    });
    expect(updated.status).toBe(Status.RUNNING);
    const listed = await ledger.listByWorkspace("operaia-lab");
    expect(listed.some((r) => r.id === created.id)).toBe(true);
  });
});
