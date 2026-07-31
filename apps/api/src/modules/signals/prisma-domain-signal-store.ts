/**
 * Prisma adapter — Domain Signal Store (S1).
 */
import {
  DuplicateDeliveryError,
  type CreateDomainSignalData,
  type DomainSignalRecord,
  type DomainSignalStore,
  type UpdateDomainSignalData,
  type UpsertBindingInput,
  type WorkspaceSourceBindingRecord,
} from "@operaia/domain-signals";
import {
  prisma,
  Prisma,
  type DomainSignal,
  type WorkspaceSourceBinding,
} from "@operaia/database";

export class PrismaDomainSignalStore implements DomainSignalStore {
  async upsertBinding(
    input: UpsertBindingInput,
  ): Promise<WorkspaceSourceBindingRecord> {
    const row = await prisma.workspaceSourceBinding.upsert({
      where: {
        workspaceId_sourceType_externalRef: {
          workspaceId: input.workspaceId,
          sourceType: input.sourceType,
          externalRef: input.externalRef,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        sourceType: input.sourceType,
        externalRef: input.externalRef,
        enabled: input.enabled ?? true,
        configJson: toJson(input.configJson),
        secretRef: input.secretRef ?? null,
      },
      update: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.configJson !== undefined
          ? { configJson: toJson(input.configJson) }
          : {}),
        ...(input.secretRef !== undefined
          ? { secretRef: input.secretRef }
          : {}),
      },
    });
    return mapBinding(row);
  }

  async findBinding(input: {
    readonly workspaceId: string;
    readonly sourceType: string;
    readonly externalRef: string;
  }): Promise<WorkspaceSourceBindingRecord | null> {
    const row = await prisma.workspaceSourceBinding.findUnique({
      where: {
        workspaceId_sourceType_externalRef: {
          workspaceId: input.workspaceId,
          sourceType: input.sourceType,
          externalRef: input.externalRef,
        },
      },
    });
    return row ? mapBinding(row) : null;
  }

  async findBindingById(
    id: string,
  ): Promise<WorkspaceSourceBindingRecord | null> {
    const row = await prisma.workspaceSourceBinding.findUnique({
      where: { id },
    });
    return row ? mapBinding(row) : null;
  }

  async findBindingsByExternalRef(input: {
    readonly sourceType: string;
    readonly externalRef: string;
    readonly enabledOnly?: boolean;
  }): Promise<readonly WorkspaceSourceBindingRecord[]> {
    const rows = await prisma.workspaceSourceBinding.findMany({
      where: {
        sourceType: input.sourceType,
        externalRef: input.externalRef.trim().toLowerCase(),
        ...(input.enabledOnly ? { enabled: true } : {}),
      },
    });
    return rows.map(mapBinding);
  }

  async listBindings(input?: {
    readonly enabledOnly?: boolean;
  }): Promise<readonly WorkspaceSourceBindingRecord[]> {
    const rows = await prisma.workspaceSourceBinding.findMany({
      where: input?.enabledOnly ? { enabled: true } : undefined,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapBinding);
  }

  async createSignal(data: CreateDomainSignalData): Promise<DomainSignalRecord> {
    try {
      const row = await prisma.domainSignal.create({
        data: {
          workspaceId: data.workspaceId,
          bindingId: data.bindingId,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          type: data.type,
          deliveryId: data.deliveryId,
          signalHash: data.signalHash,
          correlationId: data.correlationId,
          payloadJson: data.payloadJson as Prisma.InputJsonValue,
          metadataJson: toJson(data.metadataJson),
          occurredAt: data.occurredAt,
          expiresAt: data.expiresAt,
          payloadVersion: data.payloadVersion,
        },
      });
      return mapSignal(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new DuplicateDeliveryError(data.sourceType, data.deliveryId);
      }
      throw error;
    }
  }

  async findByDelivery(input: {
    readonly sourceType: string;
    readonly deliveryId: string;
  }): Promise<DomainSignalRecord | null> {
    const row = await prisma.domainSignal.findUnique({
      where: {
        sourceType_deliveryId: {
          sourceType: input.sourceType,
          deliveryId: input.deliveryId,
        },
      },
    });
    return row ? mapSignal(row) : null;
  }

  async findById(id: string): Promise<DomainSignalRecord | null> {
    const row = await prisma.domainSignal.findUnique({ where: { id } });
    return row ? mapSignal(row) : null;
  }

  async updateSignal(
    id: string,
    data: UpdateDomainSignalData,
  ): Promise<DomainSignalRecord> {
    const row = await prisma.domainSignal.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.evaluationDecision !== undefined
          ? { evaluationDecision: data.evaluationDecision }
          : {}),
        ...(data.evaluationPolicy !== undefined
          ? { evaluationPolicy: data.evaluationPolicy }
          : {}),
        ...(data.evaluationReason !== undefined
          ? { evaluationReason: data.evaluationReason }
          : {}),
        ...(data.evaluationJson !== undefined
          ? { evaluationJson: toJson(data.evaluationJson) }
          : {}),
        ...(data.evaluatedAt !== undefined
          ? { evaluatedAt: data.evaluatedAt }
          : {}),
        ...(data.missionId !== undefined ? { missionId: data.missionId } : {}),
        ...(data.convertedAt !== undefined
          ? { convertedAt: data.convertedAt }
          : {}),
        ...(data.resolvedAt !== undefined
          ? { resolvedAt: data.resolvedAt }
          : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
        ...(data.metadataJson !== undefined
          ? { metadataJson: toJson(data.metadataJson) }
          : {}),
      },
    });
    return mapSignal(row);
  }

  async findBySignalHash(input: {
    readonly workspaceId: string;
    readonly signalHash: string;
    readonly excludeId?: string;
    readonly limit?: number;
  }): Promise<readonly DomainSignalRecord[]> {
    const rows = await prisma.domainSignal.findMany({
      where: {
        workspaceId: input.workspaceId,
        signalHash: input.signalHash,
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
      orderBy: { receivedAt: "desc" },
      take: input.limit ?? 20,
    });
    return rows.map(mapSignal);
  }
}

function toJson(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

function mapBinding(row: WorkspaceSourceBinding): WorkspaceSourceBindingRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    sourceType: row.sourceType,
    externalRef: row.externalRef,
    enabled: row.enabled,
    configJson: asRecord(row.configJson),
    secretRef: row.secretRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSignal(row: DomainSignal): DomainSignalRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    bindingId: row.bindingId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    type: row.type,
    deliveryId: row.deliveryId,
    signalHash: row.signalHash,
    correlationId: row.correlationId,
    status: row.status,
    payloadJson: asRecord(row.payloadJson) ?? {},
    metadataJson: asRecord(row.metadataJson),
    evaluationDecision: row.evaluationDecision,
    evaluationPolicy: row.evaluationPolicy,
    evaluationReason: row.evaluationReason,
    evaluationJson: asRecord(row.evaluationJson),
    evaluatedAt: row.evaluatedAt,
    missionId: row.missionId,
    payloadVersion: row.payloadVersion,
    occurredAt: row.occurredAt,
    receivedAt: row.receivedAt,
    convertedAt: row.convertedAt,
    resolvedAt: row.resolvedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}
