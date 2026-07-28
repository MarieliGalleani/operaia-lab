/**
 * Governanca — propostas estruturais exigem aprovacao humana.
 * Nenhuma mudanca e aplicada automaticamente por este modulo.
 */
import { prisma, type Prisma } from "@operaia/database";

export type ApprovalStatusName =
  | "DRAFT"
  | "PROPOSED"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "IMPLEMENTING"
  | "COMPLETED";

export interface CreateProposalInput {
  readonly projectId?: string | null;
  readonly title: string;
  readonly description: string;
  readonly justification: string;
  readonly evidence?: unknown;
  readonly expectedImpact: string;
  readonly affectedComponents: readonly string[];
  readonly risks?: readonly string[];
  readonly implementationPlan: string;
  readonly rollbackPlan: string;
  readonly diffRef?: string | null;
}

export class GovernanceService {
  async createProposal(input: CreateProposalInput) {
    return prisma.changeProposal.create({
      data: {
        projectId: input.projectId ?? null,
        title: input.title,
        description: input.description,
        justification: input.justification,
        evidenceJson: (input.evidence ?? {}) as Prisma.InputJsonValue,
        expectedImpact: input.expectedImpact,
        affectedComponents: [...input.affectedComponents] as Prisma.InputJsonValue,
        risksJson: (input.risks ?? []) as Prisma.InputJsonValue,
        implementationPlan: input.implementationPlan,
        rollbackPlan: input.rollbackPlan,
        diffRef: input.diffRef ?? null,
        approvalStatus: "WAITING_APPROVAL",
      },
    });
  }

  async list(filters?: {
    readonly status?: ApprovalStatusName;
    readonly take?: number;
  }) {
    return prisma.changeProposal.findMany({
      where: filters?.status ? { approvalStatus: filters.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: filters?.take ?? 50,
    });
  }

  async get(id: string) {
    return prisma.changeProposal.findUnique({ where: { id } });
  }

  async submitForApproval(id: string) {
    return prisma.changeProposal.update({
      where: { id },
      data: { approvalStatus: "WAITING_APPROVAL" },
    });
  }

  async approve(id: string, approvedBy: string) {
    const current = await this.get(id);
    if (!current) {
      throw new Error(`Proposta nao encontrada: ${id}`);
    }
    if (current.approvalStatus !== "WAITING_APPROVAL") {
      throw new Error(
        `Proposta ${id} nao esta WAITING_APPROVAL (status=${current.approvalStatus})`,
      );
    }
    return prisma.changeProposal.update({
      where: { id },
      data: {
        approvalStatus: "APPROVED",
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  async reject(id: string, rejectedBy: string, reason: string) {
    const current = await this.get(id);
    if (!current) {
      throw new Error(`Proposta nao encontrada: ${id}`);
    }
    if (current.approvalStatus !== "WAITING_APPROVAL") {
      throw new Error(
        `Proposta ${id} nao esta WAITING_APPROVAL (status=${current.approvalStatus})`,
      );
    }
    return prisma.changeProposal.update({
      where: { id },
      data: {
        approvalStatus: "REJECTED",
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });
  }

  /**
   * Marca IMPLEMENTING — apenas apos APPROVED.
   * Nao aplica mudanca estrutural; apenas registra intencao humana.
   */
  async markImplementing(id: string) {
    const current = await this.get(id);
    if (!current || current.approvalStatus !== "APPROVED") {
      throw new Error(`Proposta ${id} precisa estar APPROVED`);
    }
    return prisma.changeProposal.update({
      where: { id },
      data: { approvalStatus: "IMPLEMENTING" },
    });
  }

  async markCompleted(id: string) {
    const current = await this.get(id);
    if (
      !current ||
      (current.approvalStatus !== "IMPLEMENTING" &&
        current.approvalStatus !== "APPROVED")
    ) {
      throw new Error(`Proposta ${id} precisa estar APPROVED ou IMPLEMENTING`);
    }
    return prisma.changeProposal.update({
      where: { id },
      data: { approvalStatus: "COMPLETED" },
    });
  }

  async countPending(): Promise<number> {
    return prisma.changeProposal.count({
      where: { approvalStatus: "WAITING_APPROVAL" },
    });
  }

  /** Bloqueia apply estrutural enquanto houver WAITING_APPROVAL critica. */
  async canApplyStructuralChange(): Promise<boolean> {
    // Politica: nunca apply automatico. Sempre false para o runtime.
    return false;
  }
}
