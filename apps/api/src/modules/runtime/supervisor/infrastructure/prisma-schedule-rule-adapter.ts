import { prisma } from "@operaia/database";
import type { ScheduleRulePort, ScheduleRuleRecord } from "../ports.js";

/** Adapter Prisma — ScheduleRulePort (fora do Supervisor puro). */
export class PrismaScheduleRuleAdapter implements ScheduleRulePort {
  async listEnabled(): Promise<readonly ScheduleRuleRecord[]> {
    const rows = await prisma.scheduleRule.findMany({
      where: { enabled: true },
    });
    return rows.map((rule) => {
      const config = (rule.configJson ?? {}) as { objective?: string };
      return {
        id: rule.id,
        workspaceId: rule.workspaceId,
        intervalSec: rule.intervalSec,
        lastEnqueuedAt: rule.lastEnqueuedAt,
        objective: config.objective,
      };
    });
  }

  async markEnqueued(id: string, at: Date): Promise<void> {
    await prisma.scheduleRule.update({
      where: { id },
      data: { lastEnqueuedAt: at },
    });
  }
}
