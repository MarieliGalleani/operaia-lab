cat > /tmp/e2e-clean.mts <<'Y'
import { prisma } from "@operaia/database";
import { writeFileSync, chmodSync } from "node:fs";
const APPLY = process.env.APPLY === "1";
const since = new Date("2026-10-19T23:00:00Z");
const DEMAND_PREFIXES = ["3f5ef2a4","15b6389f","e83a8f9c","de8be0d9","4edc8715","0aaa159f","2c79ec93","83fdb894","b0a142db"];
const all = await prisma.officeDemand.findMany({ where: { createdAt: { gte: since } } });
const demands = all.filter((d) => DEMAND_PREFIXES.some((p) => d.id.startsWith(p)));
if (demands.length !== DEMAND_PREFIXES.length) throw new Error(`esperava ${DEMAND_PREFIXES.length} demandas, achei ${demands.length}`);
const demandIds = demands.map((d) => d.id);
// missoes: raizes das demandas + "Teste E2E" + todas as descendentes
let missionIds = new Set<string>(demands.map((d) => d.missionId).filter((x): x is string => !!x));
for (const m of await prisma.mission.findMany({ where: { objective: { contains: "Teste E2E" } }, select: { id: true } })) missionIds.add(m.id);
for (;;) {
  const kids = await prisma.mission.findMany({ where: { parentMissionId: { in: [...missionIds] }, id: { notIn: [...missionIds] } }, select: { id: true } });
  if (!kids.length) break;
  kids.forEach((k) => missionIds.add(k.id));
}
const mids = [...missionIds];
const objs = demands.map((d) => d.objective.slice(0, 60));
const traces = (await prisma.officeDecisionTrace.findMany({ where: { createdAt: { gte: since } } })).filter(
  (t) => (t.missionId && missionIds.has(t.missionId)) || objs.some((o) => t.objective.startsWith(o) || t.objective.startsWith(`Executar demanda: ${o}`)),
);
const approvals = await prisma.officeApprovalRequest.findMany({ where: { OR: [{ demandId: { in: demandIds } }, { missionId: { in: mids } }] } });
const memNotes = await prisma.operationalMemoryNote.findMany({ where: { OR: [{ missionId: { in: mids } }, { sourceId: { in: mids } }] } });
const gov = await prisma.workGovernanceDecision.findMany({ where: { OR: [{ resultingMissionId: { in: mids } }, { correlationId: { in: demandIds } }] } });
const missions = await prisma.mission.findMany({ where: { id: { in: mids } }, include: { events: true, learning: true } });
const client = await prisma.client.findFirst({ where: { name: "Teste E2E" }, include: { payments: true, metricEntries: true, campaigns: { select: { id: true } }, automationEngagements: { select: { id: true } } } });
const eng = await prisma.automationEngagement.findMany({ where: { briefing: { startsWith: "Teste E2E" } } });
const camp = await prisma.marketingCampaign.findMany({ where: { briefing: { startsWith: "Teste E2E" } } });
const nicheNotes = await prisma.nicheMemoryNote.findMany({ where: { sourceId: { in: [...eng.map((e) => e.id), ...camp.map((c) => c.id)] } } });
const nicheIds = [...new Set([...eng, ...camp].map((x) => x.nicheId))];
const niches = await prisma.niche.findMany({ where: { id: { in: nicheIds } }, include: { _count: { select: { campaigns: true, automationEngagements: true, clients: true, memoryNotes: true } } } });
// nicho so sai se foi criado pelo teste e nada mais usa
const nichesToDelete = niches.filter((n) => n.createdAt >= since && n._count.campaigns === camp.filter((c) => c.nicheId === n.id).length && n._count.automationEngagements === eng.filter((e) => e.nicheId === n.id).length && n._count.clients <= (client && client.nicheId === n.id ? 1 : 0) && n._count.memoryNotes === nicheNotes.filter((x) => x.nicheId === n.id).length);
if (client && (client.payments.length || client.metricEntries.length)) throw new Error("cliente Teste E2E tem pagamentos/métricas — não apago");
const summary = { demandas: demands.length, missoes: missions.length, eventos: missions.reduce((a, m) => a + m.events.length, 0), aprendizados: missions.filter((m) => m.learning).length, aprovacoes: approvals.length, decisoes: traces.length, memoria: memNotes.length, governanca: gov.length, atlas: eng.length, mercurio: camp.length, notasNicho: nicheNotes.length, cliente: client ? 1 : 0, nichos: nichesToDelete.map((n) => n.name) };
console.log("RESUMO", JSON.stringify(summary));
if (!APPLY) { await prisma.$disconnect(); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const file = `/tmp/e2e-cleanup-backup.json`;
writeFileSync(file, JSON.stringify({ demands, missions, approvals, traces, memNotes, gov, client, eng, camp, nicheNotes, niches: nichesToDelete }, null, 1));
chmodSync(file, 0o600);
console.log("BACKUP", file);
await prisma.$transaction([
  prisma.officeApprovalRequest.deleteMany({ where: { id: { in: approvals.map((a) => a.id) } } }),
  prisma.officeDecisionTrace.deleteMany({ where: { id: { in: traces.map((t) => t.id) } } }),
  prisma.operationalMemoryNote.deleteMany({ where: { id: { in: memNotes.map((n) => n.id) } } }),
  prisma.workGovernanceDecision.deleteMany({ where: { id: { in: gov.map((g) => g.id) } } }),
  prisma.mission.deleteMany({ where: { id: { in: mids } } }),
  prisma.officeDemand.deleteMany({ where: { id: { in: demandIds } } }),
  prisma.nicheMemoryNote.deleteMany({ where: { id: { in: nicheNotes.map((n) => n.id) } } }),
  prisma.automationEngagement.deleteMany({ where: { id: { in: eng.map((e) => e.id) } } }),
  prisma.marketingCampaign.deleteMany({ where: { id: { in: camp.map((c) => c.id) } } }),
  ...(client ? [prisma.client.delete({ where: { id: client.id } })] : []),
  prisma.niche.deleteMany({ where: { id: { in: nichesToDelete.map((n) => n.id) } } }),
]);
console.log("APAGADO");
await prisma.$disconnect();
Y
docker cp /tmp/e2e-clean.mts operaia-lab-api:/app/apps/api/.e2e-clean.mts
docker exec -w /app/apps/api -e APPLY=1 operaia-lab-api npx tsx ./.e2e-clean.mts 2>&1 | tail -8
TS=$(date +%Y%m%dT%H%M%S)
docker cp operaia-lab-api:/tmp/e2e-cleanup-backup.json /opt/operaia-lab-releases/e2e-cleanup-backup-$TS.json && chmod 600 /opt/operaia-lab-releases/e2e-cleanup-backup-$TS.json && echo "saved /opt/operaia-lab-releases/e2e-cleanup-backup-$TS.json $(stat -c %s /opt/operaia-lab-releases/e2e-cleanup-backup-$TS.json) bytes"
