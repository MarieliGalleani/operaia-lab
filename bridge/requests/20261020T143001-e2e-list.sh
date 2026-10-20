cat > /tmp/e2e-list.mts <<'Y'
import { prisma } from "@operaia/database";
const since = new Date("2026-10-18T00:00:00Z");
const demands = await prisma.officeDemand.findMany({ where: { createdAt: { gte: since } }, select: { id: true, workspaceId: true, objective: true, missionId: true, status: true, createdAt: true }, orderBy: { createdAt: "asc" } });
console.log("DEMANDS (desde 18/10):"); for (const d of demands) console.log(` ${d.id.slice(0,8)} ${d.createdAt.toISOString().slice(0,16)} ${d.workspaceId} ${d.status} mission=${d.missionId?.slice(0,8) ?? "-"} | ${d.objective.slice(0,90)}`);
const eng = await prisma.automationEngagement.findMany({ where: { createdAt: { gte: since } }, select: { id: true, briefing: true, client: { select: { name: true } }, createdAt: true } });
console.log("ATLAS:"); for (const e of eng) console.log(` ${e.id.slice(0,8)} ${e.createdAt.toISOString().slice(0,16)} client=${e.client?.name ?? "-"} | ${e.briefing.slice(0,80)}`);
const camp = await prisma.marketingCampaign.findMany({ where: { createdAt: { gte: since } }, select: { id: true, briefing: true, client: { select: { name: true } }, createdAt: true } });
console.log("MERCURIO:"); for (const e of camp) console.log(` ${e.id.slice(0,8)} ${e.createdAt.toISOString().slice(0,16)} client=${e.client?.name ?? "-"} | ${e.briefing.slice(0,80)}`);
const clients = await prisma.client.findMany({ where: { name: { contains: "Teste", mode: "insensitive" } }, select: { id: true, name: true, createdAt: true, _count: { select: { campaigns: true, automationEngagements: true, payments: true, metricEntries: true } } } });
console.log("CLIENTES 'Teste':", JSON.stringify(clients));
const ms = await prisma.mission.findMany({ where: { objective: { contains: "Teste E2E" } }, select: { id: true, parentMissionId: true, workspaceId: true, ownerEmployeeId: true, createdAt: true, objective: true } });
console.log("MISSOES com 'Teste E2E':", ms.length); for (const m of ms) console.log(` ${m.id.slice(0,8)} parent=${m.parentMissionId?.slice(0,8) ?? "-"} ${m.ownerEmployeeId} ${m.createdAt.toISOString().slice(0,16)} | ${m.objective.slice(0,70)}`);
const notes = await prisma.knowledgeItem.findMany({ where: { OR: [{ title: { contains: "Teste" } }, { content: { contains: "Teste E2E" } }] }, select: { id: true, title: true } });
console.log("NOTAS conhecimento 'Teste':", JSON.stringify(notes));
await prisma.$disconnect();
Y
docker cp /tmp/e2e-list.mts operaia-lab-api:/app/apps/api/.e2e-list.mts
docker exec -w /app/apps/api operaia-lab-api npx tsx ./.e2e-list.mts 2>&1 | tail -55
