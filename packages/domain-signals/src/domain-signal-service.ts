/**
 * DomainSignalService — nucleo S1.
 * Signal informa. Opera decide. Mission executa.
 * Este servico NAO importa a fila oficial, Matcher nem ExecutionEngine.
 */
import { randomUUID } from "node:crypto";
import type { DomainSignalStore } from "./domain-signal-store.js";
import { DuplicateDeliveryError } from "./in-memory-domain-signal-store.js";
import { assertTransition } from "./lifecycle.js";
import {
  buildEvaluationJson,
  toOperaEvaluationContext,
} from "./opera-evaluation-context.js";
import { redactPayload } from "./redact.js";
import { computeSignalHash } from "./signal-hash.js";
import type {
  DomainSignalRecord,
  EvaluateSignalInput,
  IngestSignalInput,
  IngestSignalResult,
  OperaEvaluationContext,
  UpsertBindingInput,
  WorkspaceSourceBindingRecord,
} from "./types.js";

export class DomainSignalService {
  constructor(private readonly store: DomainSignalStore) {}

  upsertBinding(
    input: UpsertBindingInput,
  ): Promise<WorkspaceSourceBindingRecord> {
    return this.store.upsertBinding(input);
  }

  findBinding(input: {
    readonly workspaceId: string;
    readonly sourceType: string;
    readonly externalRef: string;
  }): Promise<WorkspaceSourceBindingRecord | null> {
    return this.store.findBinding(input);
  }

  findBindingById(
    id: string,
  ): Promise<WorkspaceSourceBindingRecord | null> {
    return this.store.findBindingById(id);
  }

  findBindingsByExternalRef(input: {
    readonly sourceType: string;
    readonly externalRef: string;
    readonly enabledOnly?: boolean;
  }): Promise<readonly WorkspaceSourceBindingRecord[]> {
    return this.store.findBindingsByExternalRef(input);
  }

  listBindings(input?: {
    readonly enabledOnly?: boolean;
  }): Promise<readonly WorkspaceSourceBindingRecord[]> {
    return this.store.listBindings(input);
  }

  async ingest(input: IngestSignalInput): Promise<IngestSignalResult> {
    if (!input.workspaceId?.trim()) {
      throw new Error("ingest exige workspaceId");
    }
    if (!input.sourceType?.trim()) {
      throw new Error("ingest exige sourceType");
    }
    if (!input.type?.trim()) {
      throw new Error("ingest exige type");
    }
    if (!input.deliveryId?.trim()) {
      throw new Error("ingest exige deliveryId");
    }

    const existing = await this.store.findByDelivery({
      sourceType: input.sourceType,
      deliveryId: input.deliveryId,
    });
    if (existing) {
      return { kind: "duplicate_delivery", signal: existing };
    }

    if (input.bindingId) {
      const binding = await this.store.findBindingById(input.bindingId);
      if (!binding) {
        throw new Error(`WorkspaceSourceBinding nao encontrado: ${input.bindingId}`);
      }
      if (binding.workspaceId !== input.workspaceId) {
        throw new Error(
          "binding.workspaceId diverge do workspaceId do sinal (isolamento)",
        );
      }
      if (!binding.enabled) {
        throw new Error("WorkspaceSourceBinding desabilitado");
      }
    }

    const payloadJson = redactPayload(input.payload);
    const signalHash =
      input.signalHash?.trim() ||
      computeSignalHash({
        workspaceId: input.workspaceId,
        type: input.type,
        sourceId: input.sourceId,
        normalizedKey: input.externalRef,
        relevantPayload: pickRelevant(payloadJson),
      });
    const correlationId =
      input.correlationId?.trim() || randomUUID();

    try {
      const signal = await this.store.createSignal({
        workspaceId: input.workspaceId,
        bindingId: input.bindingId ?? null,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        type: input.type,
        deliveryId: input.deliveryId,
        signalHash,
        correlationId,
        payloadJson,
        metadataJson: input.metadata ?? null,
        occurredAt: input.occurredAt ?? null,
        expiresAt: input.expiresAt ?? null,
        payloadVersion: input.payloadVersion ?? 1,
      });
      return { kind: "created", signal };
    } catch (error) {
      if (error instanceof DuplicateDeliveryError) {
        const again = await this.store.findByDelivery({
          sourceType: input.sourceType,
          deliveryId: input.deliveryId,
        });
        if (again) {
          return { kind: "duplicate_delivery", signal: again };
        }
      }
      throw error;
    }
  }

  async evaluate(input: EvaluateSignalInput): Promise<DomainSignalRecord> {
    const signal = await this.requireSignal(input.signalId);
    assertTransition(signal.status, "EVALUATED");

    if (!input.policy?.trim()) {
      throw new Error("evaluate exige policy");
    }
    if (!input.reason?.trim()) {
      throw new Error("evaluate exige reason");
    }

    let similarSignalIds: string[] = [];
    if (input.includeSimilar !== false) {
      const similar = await this.store.findBySignalHash({
        workspaceId: signal.workspaceId,
        signalHash: signal.signalHash,
        excludeId: signal.id,
        limit: 10,
      });
      similarSignalIds = similar.map((row) => row.id);
    }

    const appliedAt = new Date();
    const evaluationJson = buildEvaluationJson({
      decision: input.decision,
      policy: input.policy,
      reason: input.reason,
      appliedAt: appliedAt.toISOString(),
      inputs: input.inputs,
      similarSignalIds,
    });

    const nextStatus =
      input.decision === "IGNORE" ? "IGNORED" : "EVALUATED";

    if (nextStatus === "IGNORED") {
      assertTransition(signal.status, "IGNORED");
    }

    return this.store.updateSignal(signal.id, {
      status: nextStatus,
      evaluationDecision: input.decision,
      evaluationPolicy: input.policy,
      evaluationReason: input.reason,
      evaluationJson,
      evaluatedAt: appliedAt,
    });
  }

  async getOperaEvaluationContext(
    signalId: string,
  ): Promise<OperaEvaluationContext> {
    const signal = await this.requireSignal(signalId);
    const similar = await this.store.findBySignalHash({
      workspaceId: signal.workspaceId,
      signalHash: signal.signalHash,
      excludeId: signal.id,
      limit: 10,
    });
    return toOperaEvaluationContext(
      signal,
      similar.map((row) => row.id),
    );
  }

  async findById(signalId: string): Promise<DomainSignalRecord | null> {
    return this.store.findById(signalId);
  }

  /**
   * Marca CONVERTED com missionId ja conhecido.
   * S1: NAO enfileira missao — caller externo (futuro S2+) fornece missionId.
   */
  async markConverted(input: {
    readonly signalId: string;
    readonly missionId: string;
  }): Promise<DomainSignalRecord> {
    const signal = await this.requireSignal(input.signalId);
    if (signal.status !== "EVALUATED") {
      throw new Error(
        `markConverted exige status EVALUATED (atual: ${signal.status})`,
      );
    }
    if (
      signal.evaluationDecision !== "CONVERT_CANDIDATE" &&
      signal.evaluationDecision !== "DEFER"
    ) {
      throw new Error(
        "markConverted exige evaluationDecision CONVERT_CANDIDATE ou DEFER",
      );
    }
    if (!input.missionId?.trim()) {
      throw new Error("markConverted exige missionId");
    }
    assertTransition(signal.status, "CONVERTED");
    return this.store.updateSignal(signal.id, {
      status: "CONVERTED",
      missionId: input.missionId,
      convertedAt: new Date(),
    });
  }

  async markResolved(signalId: string): Promise<DomainSignalRecord> {
    const signal = await this.requireSignal(signalId);
    assertTransition(signal.status, "RESOLVED");
    return this.store.updateSignal(signalId, {
      status: "RESOLVED",
      resolvedAt: new Date(),
    });
  }

  async markExpired(signalId: string): Promise<DomainSignalRecord> {
    const signal = await this.requireSignal(signalId);
    assertTransition(signal.status, "EXPIRED");
    return this.store.updateSignal(signalId, {
      status: "EXPIRED",
      resolvedAt: new Date(),
    });
  }

  private async requireSignal(id: string): Promise<DomainSignalRecord> {
    const signal = await this.store.findById(id);
    if (!signal) {
      throw new Error(`DomainSignal nao encontrado: ${id}`);
    }
    return signal;
  }
}

function pickRelevant(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const keys = ["id", "number", "key", "ref", "url", "title", "action"];
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in payload) {
      out[key] = payload[key];
    }
  }
  return out;
}
