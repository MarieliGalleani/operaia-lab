/**
 * Decision Ledger port + InMemory (testes) + Prisma (produto).
 * Append-only — sem update de decisões históricas.
 */
import { randomUUID } from "node:crypto";
import { prisma, Prisma } from "@operaia/database";
import {
  WORK_GOVERNANCE_AUTHORITY,
  type GovernanceEvidenceRef,
  type WorkGovernanceDecisionKind,
  type WorkGovernanceDecisionRecord,
  type WorkGovernanceSource,
} from "./types.js";

export interface AppendGovernanceDecisionInput {
  readonly correlationId?: string | null;
  readonly workspaceId: string;
  readonly source: WorkGovernanceSource;
  readonly workIdentity: string;
  readonly contextFingerprint: string | null;
  readonly decision: WorkGovernanceDecisionKind;
  readonly reason: string;
  readonly resultingMissionId?: string | null;
  readonly evidences?: readonly GovernanceEvidenceRef[];
  readonly forceExecute?: boolean;
}

export interface WorkGovernanceLedgerPort {
  append(
    input: AppendGovernanceDecisionInput,
  ): Promise<WorkGovernanceDecisionRecord>;
  findByCorrelationId(
    correlationId: string,
  ): Promise<WorkGovernanceDecisionRecord | null>;
  listByWorkIdentity(
    workspaceId: string,
    workIdentity: string,
    take?: number,
  ): Promise<readonly WorkGovernanceDecisionRecord[]>;
}

export class InMemoryWorkGovernanceLedger
  implements WorkGovernanceLedgerPort
{
  private readonly rows: WorkGovernanceDecisionRecord[] = [];

  async append(
    input: AppendGovernanceDecisionInput,
  ): Promise<WorkGovernanceDecisionRecord> {
    if (input.correlationId) {
      const existing = await this.findByCorrelationId(input.correlationId);
      if (existing) {
        return existing;
      }
    }
    const row: WorkGovernanceDecisionRecord = {
      id: randomUUID(),
      correlationId: input.correlationId?.trim() || null,
      workspaceId: input.workspaceId,
      source: input.source,
      workIdentity: input.workIdentity,
      contextFingerprint: input.contextFingerprint,
      decision: input.decision,
      reason: input.reason,
      authority: WORK_GOVERNANCE_AUTHORITY,
      resultingMissionId: input.resultingMissionId ?? null,
      evidences: input.evidences ?? [],
      forceExecute: input.forceExecute === true,
      createdAt: new Date(),
    };
    this.rows.push(row);
    return row;
  }

  async findByCorrelationId(
    correlationId: string,
  ): Promise<WorkGovernanceDecisionRecord | null> {
    const key = correlationId.trim();
    return this.rows.find((row) => row.correlationId === key) ?? null;
  }

  async listByWorkIdentity(
    workspaceId: string,
    workIdentity: string,
    take = 20,
  ): Promise<readonly WorkGovernanceDecisionRecord[]> {
    return this.rows
      .filter(
        (row) =>
          row.workspaceId === workspaceId &&
          row.workIdentity === workIdentity,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, take);
  }
}

export class PrismaWorkGovernanceLedger implements WorkGovernanceLedgerPort {
  async append(
    input: AppendGovernanceDecisionInput,
  ): Promise<WorkGovernanceDecisionRecord> {
    if (input.correlationId?.trim()) {
      const existing = await this.findByCorrelationId(input.correlationId);
      if (existing) {
        return existing;
      }
    }

    try {
      const created = await prisma.workGovernanceDecision.create({
        data: {
          correlationId: input.correlationId?.trim() || null,
          workspaceId: input.workspaceId,
          source: input.source,
          workIdentity: input.workIdentity,
          contextFingerprint: input.contextFingerprint,
          decision: input.decision,
          reason: input.reason,
          authority: WORK_GOVERNANCE_AUTHORITY,
          resultingMissionId: input.resultingMissionId ?? null,
          evidencesJson: (input.evidences ?? []) as unknown as Prisma.InputJsonValue,
          forceExecute: input.forceExecute === true,
        },
      });
      return toRecord(created);
    } catch (error) {
      if (
        input.correlationId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await this.findByCorrelationId(input.correlationId);
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  async findByCorrelationId(
    correlationId: string,
  ): Promise<WorkGovernanceDecisionRecord | null> {
    const row = await prisma.workGovernanceDecision.findUnique({
      where: { correlationId: correlationId.trim() },
    });
    return row ? toRecord(row) : null;
  }

  async listByWorkIdentity(
    workspaceId: string,
    workIdentity: string,
    take = 20,
  ): Promise<readonly WorkGovernanceDecisionRecord[]> {
    const rows = await prisma.workGovernanceDecision.findMany({
      where: { workspaceId, workIdentity },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map(toRecord);
  }
}

type PrismaRow = {
  id: string;
  correlationId: string | null;
  workspaceId: string;
  source: string;
  workIdentity: string;
  contextFingerprint: string | null;
  decision: string;
  reason: string;
  authority: string;
  resultingMissionId: string | null;
  evidencesJson: unknown;
  forceExecute: boolean;
  createdAt: Date;
};

function toRecord(row: PrismaRow): WorkGovernanceDecisionRecord {
  const evidences = Array.isArray(row.evidencesJson)
    ? (row.evidencesJson as GovernanceEvidenceRef[])
    : [];
  return {
    id: row.id,
    correlationId: row.correlationId,
    workspaceId: row.workspaceId,
    source: row.source as WorkGovernanceSource,
    workIdentity: row.workIdentity,
    contextFingerprint: row.contextFingerprint,
    decision: row.decision as WorkGovernanceDecisionKind,
    reason: row.reason,
    authority: row.authority,
    resultingMissionId: row.resultingMissionId,
    evidences,
    forceExecute: row.forceExecute,
    createdAt: row.createdAt,
  };
}
