import { randomUUID } from "node:crypto";
import type {
  CreateDomainSignalData,
  DomainSignalStore,
  UpdateDomainSignalData,
} from "./domain-signal-store.js";
import type {
  DomainSignalRecord,
  UpsertBindingInput,
  WorkspaceSourceBindingRecord,
} from "./types.js";

/**
 * Store em memoria para testes unitarios (sem Prisma).
 */
export class InMemoryDomainSignalStore implements DomainSignalStore {
  private readonly bindings = new Map<string, WorkspaceSourceBindingRecord>();
  private readonly signals = new Map<string, DomainSignalRecord>();

  async upsertBinding(
    input: UpsertBindingInput,
  ): Promise<WorkspaceSourceBindingRecord> {
    const key = bindingKey(
      input.workspaceId,
      input.sourceType,
      input.externalRef,
    );
    const existing = [...this.bindings.values()].find(
      (row) =>
        row.workspaceId === input.workspaceId &&
        row.sourceType === input.sourceType &&
        row.externalRef === input.externalRef,
    );
    const now = new Date();
    if (existing) {
      const updated: WorkspaceSourceBindingRecord = {
        ...existing,
        enabled: input.enabled ?? existing.enabled,
        configJson:
          input.configJson !== undefined
            ? input.configJson
            : existing.configJson,
        secretRef:
          input.secretRef !== undefined ? input.secretRef : existing.secretRef,
        updatedAt: now,
      };
      this.bindings.set(existing.id, updated);
      return updated;
    }
    const created: WorkspaceSourceBindingRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      sourceType: input.sourceType,
      externalRef: input.externalRef,
      enabled: input.enabled ?? true,
      configJson: input.configJson ?? null,
      secretRef: input.secretRef ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.bindings.set(created.id, created);
    void key;
    return created;
  }

  async findBinding(input: {
    readonly workspaceId: string;
    readonly sourceType: string;
    readonly externalRef: string;
  }): Promise<WorkspaceSourceBindingRecord | null> {
    return (
      [...this.bindings.values()].find(
        (row) =>
          row.workspaceId === input.workspaceId &&
          row.sourceType === input.sourceType &&
          row.externalRef === input.externalRef,
      ) ?? null
    );
  }

  async findBindingById(
    id: string,
  ): Promise<WorkspaceSourceBindingRecord | null> {
    return this.bindings.get(id) ?? null;
  }

  async createSignal(data: CreateDomainSignalData): Promise<DomainSignalRecord> {
    const dup = await this.findByDelivery({
      sourceType: data.sourceType,
      deliveryId: data.deliveryId,
    });
    if (dup) {
      throw new DuplicateDeliveryError(data.sourceType, data.deliveryId);
    }
    const now = new Date();
    const row: DomainSignalRecord = {
      id: randomUUID(),
      workspaceId: data.workspaceId,
      bindingId: data.bindingId,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      type: data.type,
      deliveryId: data.deliveryId,
      signalHash: data.signalHash,
      correlationId: data.correlationId,
      status: "DETECTED",
      payloadJson: data.payloadJson,
      metadataJson: data.metadataJson,
      evaluationDecision: null,
      evaluationPolicy: null,
      evaluationReason: null,
      evaluationJson: null,
      evaluatedAt: null,
      missionId: null,
      payloadVersion: data.payloadVersion,
      occurredAt: data.occurredAt,
      receivedAt: now,
      convertedAt: null,
      resolvedAt: null,
      expiresAt: data.expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    this.signals.set(row.id, row);
    return row;
  }

  async findByDelivery(input: {
    readonly sourceType: string;
    readonly deliveryId: string;
  }): Promise<DomainSignalRecord | null> {
    return (
      [...this.signals.values()].find(
        (row) =>
          row.sourceType === input.sourceType &&
          row.deliveryId === input.deliveryId,
      ) ?? null
    );
  }

  async findById(id: string): Promise<DomainSignalRecord | null> {
    return this.signals.get(id) ?? null;
  }

  async updateSignal(
    id: string,
    data: UpdateDomainSignalData,
  ): Promise<DomainSignalRecord> {
    const existing = this.signals.get(id);
    if (!existing) {
      throw new Error(`DomainSignal nao encontrado: ${id}`);
    }
    const updated: DomainSignalRecord = {
      ...existing,
      status: data.status ?? existing.status,
      evaluationDecision:
        data.evaluationDecision !== undefined
          ? data.evaluationDecision
          : existing.evaluationDecision,
      evaluationPolicy:
        data.evaluationPolicy !== undefined
          ? data.evaluationPolicy
          : existing.evaluationPolicy,
      evaluationReason:
        data.evaluationReason !== undefined
          ? data.evaluationReason
          : existing.evaluationReason,
      evaluationJson:
        data.evaluationJson !== undefined
          ? data.evaluationJson
          : existing.evaluationJson,
      evaluatedAt:
        data.evaluatedAt !== undefined
          ? data.evaluatedAt
          : existing.evaluatedAt,
      missionId:
        data.missionId !== undefined ? data.missionId : existing.missionId,
      convertedAt:
        data.convertedAt !== undefined
          ? data.convertedAt
          : existing.convertedAt,
      resolvedAt:
        data.resolvedAt !== undefined ? data.resolvedAt : existing.resolvedAt,
      expiresAt:
        data.expiresAt !== undefined ? data.expiresAt : existing.expiresAt,
      metadataJson:
        data.metadataJson !== undefined
          ? data.metadataJson
          : existing.metadataJson,
      updatedAt: new Date(),
    };
    this.signals.set(id, updated);
    return updated;
  }

  async findBySignalHash(input: {
    readonly workspaceId: string;
    readonly signalHash: string;
    readonly excludeId?: string;
    readonly limit?: number;
  }): Promise<readonly DomainSignalRecord[]> {
    const limit = input.limit ?? 20;
    return [...this.signals.values()]
      .filter(
        (row) =>
          row.workspaceId === input.workspaceId &&
          row.signalHash === input.signalHash &&
          row.id !== input.excludeId,
      )
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
      .slice(0, limit);
  }
}

export class DuplicateDeliveryError extends Error {
  readonly code = "DUPLICATE_DELIVERY" as const;

  constructor(
    readonly sourceType: string,
    readonly deliveryId: string,
  ) {
    super(
      `Delivery duplicada: sourceType=${sourceType} deliveryId=${deliveryId}`,
    );
    this.name = "DuplicateDeliveryError";
  }
}

function bindingKey(
  workspaceId: string,
  sourceType: string,
  externalRef: string,
): string {
  return `${workspaceId}|${sourceType}|${externalRef}`;
}
