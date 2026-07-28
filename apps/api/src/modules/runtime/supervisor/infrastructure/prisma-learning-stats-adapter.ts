import { prisma } from "@operaia/database";
import type { LearningStatsPort } from "../ports.js";

/** Adapter Prisma — LearningStatsPort (fora do Supervisor puro). */
export class PrismaLearningStatsAdapter implements LearningStatsPort {
  async count(): Promise<number> {
    return prisma.missionLearning.count();
  }
}
