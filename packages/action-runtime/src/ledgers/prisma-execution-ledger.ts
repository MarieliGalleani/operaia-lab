/**
 * PrismaExecutionLedger — auditoria persistente (mesmo contrato ExecutionLedger).
 * Client Prisma injetavel — testavel sem DB real / sem shell.
 */
import { randomUUID } from "node:crypto";
import type {
  ActionExecutionRecord,
  ActionExecutionStatus,
} from "../action-types.js";
import type {
  CompleteExecutionInput,
  CreateExecutionInput,
  ExecutionLedger,
  ExecutionStatusPatch,
} from "./execution-ledger.js";

/** Linha ActionExecution (espelho do model Prisma). */
export interface ActionExecutionRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly employeeId: string;
  readonly actionId: string;
  readonly target: string;
  readonly status: ActionExecutionStatus;
  readonly requestedAt: Date;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly result: unknown | null;
  readonly error: string | null;
}

/**
 * Subconjunto tipado do PrismaClient.actionExecution — evita acoplar o package
 * ao @prisma/client em testes (mock injetavel).
 */
export interface ActionExecutionPrismaDelegate {
  create(args: {
    readonly data: {
      readonly id: string;
      readonly workspaceId: string;
      readonly employeeId: string;
      readonly actionId: string;
      readonly target: string;
      readonly status: ActionExecutionStatus;
      readonly requestedAt: Date;
    };
  }): Promise<ActionExecutionRow>;

  update(args: {
    readonly where: { readonly id: string };
    readonly data: {
      readonly status?: ActionExecutionStatus;
      readonly startedAt?: Date | null;
      readonly finishedAt?: Date | null;
      readonly result?: unknown | null;
      readonly error?: string | null;
    };
  }): Promise<ActionExecutionRow>;

  findUnique(args: {
    readonly where: { readonly id: string };
  }): Promise<ActionExecutionRow | null>;

  findMany(args: {
    readonly where: {
      readonly workspaceId?: string;
      readonly actionId?: string;
    };
    readonly orderBy?: { readonly requestedAt: "asc" | "desc" };
  }): Promise<ActionExecutionRow[]>;
}

export interface ActionExecutionPrismaClient {
  readonly actionExecution: ActionExecutionPrismaDelegate;
}

export class PrismaExecutionLedger implements ExecutionLedger {
  constructor(private readonly db: ActionExecutionPrismaClient) {}

  create(input: CreateExecutionInput): Promise<ActionExecutionRecord> {
    return this.createExecution(input);
  }

  async createExecution(
    input: CreateExecutionInput,
  ): Promise<ActionExecutionRecord> {
    const row = await this.db.actionExecution.create({
      data: {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        employeeId: input.employeeId,
        actionId: input.actionId,
        target: input.target,
        status: "REQUESTED",
        requestedAt: new Date(),
      },
    });
    return mapRow(row);
  }

  updateStatus(
    id: string,
    status: ActionExecutionStatus,
    patch: ExecutionStatusPatch = {},
  ): Promise<ActionExecutionRecord> {
    return this.updateExecutionStatus(id, status, patch);
  }

  async updateExecutionStatus(
    id: string,
    status: ActionExecutionStatus,
    patch: ExecutionStatusPatch = {},
  ): Promise<ActionExecutionRecord> {
    const data: {
      status: ActionExecutionStatus;
      startedAt?: Date | null;
      finishedAt?: Date | null;
      result?: unknown | null;
      error?: string | null;
    } = { status };

    if (patch.startedAt !== undefined) {
      data.startedAt =
        patch.startedAt === null ? null : new Date(patch.startedAt);
    }
    if (patch.finishedAt !== undefined) {
      data.finishedAt =
        patch.finishedAt === null ? null : new Date(patch.finishedAt);
    }
    if (patch.result !== undefined) {
      data.result = patch.result;
    }
    if (patch.error !== undefined) {
      data.error = patch.error;
    }

    const row = await this.db.actionExecution.update({
      where: { id },
      data,
    });
    return mapRow(row);
  }

  async completeExecution(
    id: string,
    input: CompleteExecutionInput,
  ): Promise<ActionExecutionRecord> {
    return this.updateExecutionStatus(id, input.status, {
      finishedAt: input.finishedAt ?? new Date().toISOString(),
      result: input.result ?? null,
      error: input.error ?? null,
    });
  }

  async getById(id: string): Promise<ActionExecutionRecord | null> {
    const row = await this.db.actionExecution.findUnique({ where: { id } });
    return row ? mapRow(row) : null;
  }

  findByWorkspace(
    workspaceId: string,
  ): Promise<readonly ActionExecutionRecord[]> {
    return this.listByWorkspace(workspaceId);
  }

  async findByAction(
    actionId: string,
    options: { readonly workspaceId?: string } = {},
  ): Promise<readonly ActionExecutionRecord[]> {
    const rows = await this.db.actionExecution.findMany({
      where: {
        actionId,
        ...(options.workspaceId
          ? { workspaceId: options.workspaceId }
          : {}),
      },
      orderBy: { requestedAt: "desc" },
    });
    return rows.map(mapRow);
  }

  async listByWorkspace(
    workspaceId: string,
  ): Promise<readonly ActionExecutionRecord[]> {
    const rows = await this.db.actionExecution.findMany({
      where: { workspaceId },
      orderBy: { requestedAt: "desc" },
    });
    return rows.map(mapRow);
  }
}

function mapRow(row: ActionExecutionRow): ActionExecutionRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    employeeId: row.employeeId,
    actionId: row.actionId,
    target: row.target,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    result: row.result ?? null,
    error: row.error,
  };
}
