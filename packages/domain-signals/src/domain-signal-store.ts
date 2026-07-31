import type {
  DomainSignalRecord,
  UpsertBindingInput,
  WorkspaceSourceBindingRecord,
} from "./types.js";

export interface CreateDomainSignalData {
  readonly workspaceId: string;
  readonly bindingId: string | null;
  readonly sourceType: string;
  readonly sourceId: string | null;
  readonly type: string;
  readonly deliveryId: string;
  readonly signalHash: string;
  readonly correlationId: string;
  readonly payloadJson: Record<string, unknown>;
  readonly metadataJson: Record<string, unknown> | null;
  readonly occurredAt: Date | null;
  readonly expiresAt: Date | null;
  readonly payloadVersion: number;
}

export interface UpdateDomainSignalData {
  readonly status?: DomainSignalRecord["status"];
  readonly evaluationDecision?: DomainSignalRecord["evaluationDecision"];
  readonly evaluationPolicy?: string | null;
  readonly evaluationReason?: string | null;
  readonly evaluationJson?: Record<string, unknown> | null;
  readonly evaluatedAt?: Date | null;
  readonly missionId?: string | null;
  readonly convertedAt?: Date | null;
  readonly resolvedAt?: Date | null;
  readonly expiresAt?: Date | null;
  readonly metadataJson?: Record<string, unknown> | null;
}

/**
 * Porta de persistencia — implementacoes Prisma / in-memory.
 * Sem dependencia da fila oficial de missoes.
 */
export interface DomainSignalStore {
  upsertBinding(
    input: UpsertBindingInput,
  ): Promise<WorkspaceSourceBindingRecord>;

  findBinding(input: {
    readonly workspaceId: string;
    readonly sourceType: string;
    readonly externalRef: string;
  }): Promise<WorkspaceSourceBindingRecord | null>;

  findBindingById(
    id: string,
  ): Promise<WorkspaceSourceBindingRecord | null>;

  /**
   * Resolve binding(s) por origem externa (ex.: owner/repo no webhook GitHub).
   * Pode retornar multiplos workspaces ligados ao mesmo repo.
   */
  findBindingsByExternalRef(input: {
    readonly sourceType: string;
    readonly externalRef: string;
    readonly enabledOnly?: boolean;
  }): Promise<readonly WorkspaceSourceBindingRecord[]>;

  /**
   * Lista bindings (opcionalmente so enabled) — bootstrap multi-workspace.
   */
  listBindings(input?: {
    readonly enabledOnly?: boolean;
  }): Promise<readonly WorkspaceSourceBindingRecord[]>;

  createSignal(data: CreateDomainSignalData): Promise<DomainSignalRecord>;

  findByDelivery(input: {
    readonly sourceType: string;
    readonly deliveryId: string;
  }): Promise<DomainSignalRecord | null>;

  findById(id: string): Promise<DomainSignalRecord | null>;

  updateSignal(
    id: string,
    data: UpdateDomainSignalData,
  ): Promise<DomainSignalRecord>;

  /**
   * Lookup de similaridade — NAO e dedupe bloqueante.
   */
  findBySignalHash(input: {
    readonly workspaceId: string;
    readonly signalHash: string;
    readonly excludeId?: string;
    readonly limit?: number;
  }): Promise<readonly DomainSignalRecord[]>;
}
