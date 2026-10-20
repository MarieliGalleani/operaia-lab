/**
 * Sala da Opera — retrato real do escritorio (somente leitura).
 *
 * Antes a sala mostrava "0 ativos / 0 tarefas" com 17 projetos rodando e o
 * chat respondia um texto pronto sobre o workspace "nexo". Este retrato e a
 * unica fonte da sala: o painel lateral mostra exatamente o que a Opera ve,
 * e o chat responde a partir dele.
 */
import { prisma } from "@operaia/database";
import { OFFICIAL_OPERATIONAL_WORKSPACES } from "../projects/official-operational-catalog.js";
import {
  officialWorkspaceFilter,
  resolveWorkspaceName,
} from "../automation-office/workspace-catalog.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const HUMAN_DEMAND = "[HUMAN_DEMAND]";

export interface BriefingHealth {
  readonly level: string;
  readonly label: string;
  readonly summary: string;
  readonly workersAlive: number;
  readonly workersExpected: number;
  readonly queued: number;
  readonly running: number;
  readonly waiting: number;
}

export interface BriefingApproval {
  readonly id: string;
  readonly title: string;
  readonly risk: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly createdAt: string;
}

export interface BriefingMission {
  readonly id: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly objective: string;
  readonly human: boolean;
  readonly at: string;
}

export interface BriefingDelivery {
  readonly missionId: string;
  readonly rootMissionId: string | null;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly employeeId: string;
  readonly request: string;
  readonly summary: string;
  readonly findings: readonly string[];
  readonly recommendations: readonly string[];
  readonly finishedAt: string;
}

export interface BriefingFailure extends BriefingMission {
  readonly error: string;
}

export interface BriefingFloorRun {
  readonly id: string;
  readonly floor: "automation" | "marketing";
  readonly title: string;
  readonly status: string;
  /** true quando nenhuma etapa usou IA (todas no modo reserva). */
  readonly allFallback: boolean;
  readonly createdAt: string;
}

export interface BriefingProject {
  readonly workspaceId: string;
  readonly name: string;
  readonly kind: string;
  readonly missions24h: number;
  readonly failures24h: number;
}

export interface CeoBriefing {
  readonly generatedAt: string;
  readonly health: BriefingHealth | null;
  readonly approvalsPending: readonly BriefingApproval[];
  readonly running: readonly BriefingMission[];
  readonly queued: readonly BriefingMission[];
  readonly deliveries: readonly BriefingDelivery[];
  readonly failures: readonly BriefingFailure[];
  readonly counts24h: {
    readonly completed: number;
    readonly failed: number;
    readonly human: number;
    readonly automatic: number;
  };
  readonly floorRuns: readonly BriefingFloorRun[];
  readonly projects: readonly BriefingProject[];
}

/** Objetivo como a usuaria escreveu, sem marcas internas do runtime. */
export function cleanObjective(objective: string): string {
  const intent = /\[MISSION_INTENT\]\s*([A-Z_]+)/.exec(objective)?.[1];
  const cleaned = objective
    .replace(/\[HUMAN_DEMAND\]/g, "")
    .replace(/\[MISSION_INTENT\][^\n]*/g, "")
    .replace(/\[[A-Z_]+(?::[^\]]*)?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned) return cleaned;
  if (intent === "OPERATIONAL_REVIEW") return "Revisão operacional automática";
  return intent ? intent.toLowerCase().replace(/_/g, " ") : "Missão sem objetivo";
}

/** Erro curto e sem detalhes internos (stack, caminhos, chaves). */
export function cleanError(error: string | null): string {
  if (!error) return "Falhou sem mensagem de erro.";
  return error
    .split("\n")[0]!
    .replace(/(sk-[\w-]{8,}|AIza[\w-]{10,}|ghp_[\w]{10,}|Bearer\s+\S+)/g, "[oculto]")
    .slice(0, 200);
}

const CANNED_SUMMARIES = [
  "Analisei o workspace, priorizei as pendencias",
  "Consolidei as entregas da equipe",
];

/** Le a entrega do especialista. Texto pronto do modo reserva conta como vazio. */
export function readDelivery(resultJson: unknown): {
  summary: string;
  findings: string[];
  recommendations: string[];
  canned: boolean;
} | null {
  const j = resultJson as Record<string, unknown> | null;
  const delivery = (j?.["delivery"] ?? null) as Record<string, unknown> | null;
  if (!delivery) return null;
  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, 5) : [];
  const summary = typeof delivery["summary"] === "string" ? delivery["summary"].trim() : "";
  const canned = summary === "" || CANNED_SUMMARIES.some((c) => summary.startsWith(c));
  return {
    summary,
    findings: list(delivery["findings"]).filter((f) => f !== summary),
    recommendations: list(delivery["recommendations"]),
    canned,
  };
}

export interface BriefingDeps {
  /** Status do escritorio (supervisor, workers, fila). Null se indisponivel. */
  readonly loadHealth: () => Promise<BriefingHealth | null>;
}

export async function buildCeoBriefing(deps: BriefingDeps): Promise<CeoBriefing> {
  const now = Date.now();
  const since24h = new Date(now - DAY_MS);
  const since7d = new Date(now - 7 * DAY_MS);
  const official = officialWorkspaceFilter();

  const [health, approvals, roots, active, deliveriesRaw, engagements, campaigns] = await Promise.all([
    deps.loadHealth().catch(() => null),
    prisma.officeApprovalRequest.findMany({
      where: { status: "PENDING", ...official },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.mission.findMany({
      where: { parentMissionId: null, updatedAt: { gte: since24h }, ...official },
      select: { id: true, workspaceId: true, objective: true, status: true, lastError: true, finishedAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    prisma.mission.findMany({
      where: { parentMissionId: null, status: { in: ["RUNNING", "QUEUED", "CREATED", "WAITING"] }, ...official },
      select: { id: true, workspaceId: true, objective: true, status: true, startedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.mission.findMany({
      where: {
        objective: { contains: HUMAN_DEMAND },
        ownerEmployeeId: { not: "operaia-ceo" },
        status: "COMPLETED",
        finishedAt: { gte: since7d },
        ...official,
      },
      select: { id: true, parentMissionId: true, workspaceId: true, objective: true, ownerEmployeeId: true, finishedAt: true, resultJson: true },
      orderBy: { finishedAt: "desc" },
      take: 8,
    }),
    prisma.automationEngagement.findMany({
      where: { createdAt: { gte: since7d } },
      select: { id: true, niche: true, briefing: true, status: true, fallbackStagesJson: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.marketingCampaign.findMany({
      where: { createdAt: { gte: since7d } },
      select: { id: true, niche: true, briefing: true, status: true, fallbackStagesJson: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const toMission = (m: { id: string; workspaceId: string; objective: string }, at: Date): BriefingMission => ({
    id: m.id,
    workspaceId: m.workspaceId,
    workspaceName: resolveWorkspaceName(m.workspaceId),
    objective: cleanObjective(m.objective),
    human: m.objective.includes(HUMAN_DEMAND),
    at: at.toISOString(),
  });

  const failures: BriefingFailure[] = roots
    .filter((m) => m.status === "FAILED")
    .slice(0, 8)
    .map((m) => ({ ...toMission(m, m.finishedAt ?? m.updatedAt), error: cleanError(m.lastError) }));

  const deliveries: BriefingDelivery[] = [];
  for (const m of deliveriesRaw) {
    const d = readDelivery(m.resultJson);
    if (!d) continue;
    deliveries.push({
      missionId: m.id,
      rootMissionId: m.parentMissionId,
      workspaceId: m.workspaceId,
      workspaceName: resolveWorkspaceName(m.workspaceId),
      employeeId: m.ownerEmployeeId,
      request: cleanObjective(m.objective),
      summary: d.canned ? "" : d.summary,
      findings: d.canned ? [] : d.findings,
      recommendations: d.canned ? [] : d.recommendations,
      finishedAt: (m.finishedAt ?? new Date()).toISOString(),
    });
  }

  const allFallback = (stages: unknown, status: string) =>
    status === "DONE" && Array.isArray(stages) && stages.length >= 5;
  const floorRuns: BriefingFloorRun[] = [
    ...engagements.map((e) => ({
      id: e.id,
      floor: "automation" as const,
      title: `${e.niche} — ${e.briefing.slice(0, 80)}`,
      status: e.status,
      allFallback: allFallback(e.fallbackStagesJson, e.status),
      createdAt: e.createdAt.toISOString(),
    })),
    ...campaigns.map((c) => ({
      id: c.id,
      floor: "marketing" as const,
      title: `${c.niche} — ${c.briefing.slice(0, 80)}`,
      status: c.status,
      allFallback: allFallback(c.fallbackStagesJson, c.status),
      createdAt: c.createdAt.toISOString(),
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const perProject = new Map<string, { missions: number; failures: number }>();
  for (const m of roots) {
    const p = perProject.get(m.workspaceId) ?? { missions: 0, failures: 0 };
    p.missions += 1;
    if (m.status === "FAILED") p.failures += 1;
    perProject.set(m.workspaceId, p);
  }

  return {
    generatedAt: new Date(now).toISOString(),
    health,
    approvalsPending: approvals.map((a) => ({
      id: a.id,
      title: a.action,
      risk: a.risk,
      workspaceId: a.workspaceId,
      workspaceName: resolveWorkspaceName(a.workspaceId),
      createdAt: a.createdAt.toISOString(),
    })),
    running: active.filter((m) => m.status === "RUNNING").map((m) => toMission(m, m.startedAt ?? m.createdAt)),
    queued: active.filter((m) => m.status !== "RUNNING").map((m) => toMission(m, m.createdAt)),
    deliveries,
    failures,
    counts24h: {
      completed: roots.filter((m) => m.status === "COMPLETED").length,
      failed: roots.filter((m) => m.status === "FAILED").length,
      human: roots.filter((m) => m.objective.includes(HUMAN_DEMAND)).length,
      automatic: roots.filter((m) => !m.objective.includes(HUMAN_DEMAND)).length,
    },
    floorRuns,
    projects: OFFICIAL_OPERATIONAL_WORKSPACES.map((w) => ({
      workspaceId: w.workspaceId,
      name: w.name,
      kind: w.kind,
      missions24h: perProject.get(w.workspaceId)?.missions ?? 0,
      failures24h: perProject.get(w.workspaceId)?.failures ?? 0,
    })),
  };
}
