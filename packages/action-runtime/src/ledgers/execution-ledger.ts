/**
 * Contrato ExecutionLedger — auditoria de acoes controladas.
 */
import { randomUUID } from "node:crypto";
import type {
  ActionExecutionRecord,
  ActionExecutionStatus,
} from "../action-types.js";
import { ActionExecutionStatus as Status } from "../action-types.js";

export interface CreateExecutionInput {
  readonly workspaceId: string;
  readonly employeeId: string;
  readonly actionId: string;
  readonly target: string;
}

export interface ExecutionStatusPatch {
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
  readonly result?: unknown | null;
  readonly error?: string | null;
}

export interface CompleteExecutionInput {
  readonly status:
    | typeof Status.SUCCESS
    | typeof Status.FAILED
    | typeof Status.DENIED;
  readonly result?: unknown | null;
  readonly error?: string | null;
  readonly finishedAt?: string;
}

/**
 * Contrato unico — ActionExecutor usa create/updateStatus;
 * Workers/futuro usam createExecution/completeExecution/find*.
 */
export interface ExecutionLedger {
  create(input: CreateExecutionInput): Promise<ActionExecutionRecord>;
  createExecution(input: CreateExecutionInput): Promise<ActionExecutionRecord>;

  updateStatus(
    id: string,
    status: ActionExecutionStatus,
    patch?: ExecutionStatusPatch,
  ): Promise<ActionExecutionRecord>;
  updateExecutionStatus(
    id: string,
    status: ActionExecutionStatus,
    patch?: ExecutionStatusPatch,
  ): Promise<ActionExecutionRecord>;

  completeExecution(
    id: string,
    input: CompleteExecutionInput,
  ): Promise<ActionExecutionRecord>;

  getById(id: string): Promise<ActionExecutionRecord | null>;
  findByWorkspace(
    workspaceId: string,
  ): Promise<readonly ActionExecutionRecord[]>;
  findByAction(
    actionId: string,
    options?: { readonly workspaceId?: string },
  ): Promise<readonly ActionExecutionRecord[]>;
  listByWorkspace(
    workspaceId: string,
  ): Promise<readonly ActionExecutionRecord[]>;
}

type MutableRecord = {
  id: string;
  workspaceId: string;
  employeeId: string;
  actionId: string;
  target: string;
  status: ActionExecutionStatus;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  result: unknown | null;
  error: string | null;
};

/**
 * Default em testes/dev — mesma semantica do PrismaExecutionLedger.
 */
export class InMemoryExecutionLedger implements ExecutionLedger {
  private readonly records = new Map<string, MutableRecord>();

  create(input: CreateExecutionInput): Promise<ActionExecutionRecord> {
    return this.createExecution(input);
  }

  async createExecution(
    input: CreateExecutionInput,
  ): Promise<ActionExecutionRecord> {
    const record: MutableRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      employeeId: input.employeeId,
      actionId: input.actionId,
      target: input.target,
      status: Status.REQUESTED,
      requestedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
    };
    this.records.set(record.id, record);
    return freeze(record);
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
    const current = this.records.get(id);
    if (!current) {
      throw new Error(`ExecutionLedger: registro nao encontrado: ${id}`);
    }
    current.status = status;
    if (patch.startedAt !== undefined) {
      current.startedAt = patch.startedAt;
    }
    if (patch.finishedAt !== undefined) {
      current.finishedAt = patch.finishedAt;
    }
    if (patch.result !== undefined) {
      current.result = patch.result;
    }
    if (patch.error !== undefined) {
      current.error = patch.error;
    }
    return freeze(current);
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
    const record = this.records.get(id);
    return record ? freeze(record) : null;
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
    return [...this.records.values()]
      .filter((r) => r.actionId === actionId)
      .filter(
        (r) =>
          !options.workspaceId || r.workspaceId === options.workspaceId,
      )
      .map(freeze);
  }

  async listByWorkspace(
    workspaceId: string,
  ): Promise<readonly ActionExecutionRecord[]> {
    return [...this.records.values()]
      .filter((r) => r.workspaceId === workspaceId)
      .map(freeze);
  }
}

function freeze(record: MutableRecord): ActionExecutionRecord {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    employeeId: record.employeeId,
    actionId: record.actionId,
    target: record.target,
    status: record.status,
    requestedAt: record.requestedAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    result: record.result,
    error: record.error,
  };
}
