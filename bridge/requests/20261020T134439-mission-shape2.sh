cat > /tmp/ms.mts <<"X"
import { prisma } from "@operaia/database";
const rows = await prisma.mission.findMany({ where: { objective: { contains: "[HUMAN_DEMAND]" }, status: "COMPLETED" }, orderBy: { finishedAt: "desc" }, take: 3, select: { id: true, parentMissionId: true, ownerEmployeeId: true, resultJson: true } });
for (const r of rows) { const j = r.resultJson as any; console.log(JSON.stringify({ owner: r.ownerEmployeeId, child: !!r.parentMissionId, keys: j ? Object.keys(j) : null, usable: String(j?.usableResult ?? "").slice(0, 220), outKeys: j?.final?.output ? Object.keys(j.final.output) : j?.output ? Object.keys(j.output) : null })); }
const c = await prisma.mission.groupBy({ by: ["status"], where: { parentMissionId: null, updatedAt: { gte: new Date(Date.now() - 86400000) } }, _count: true });
console.log(JSON.stringify(c));
await prisma.$disconnect();
X
docker cp /tmp/ms.mts operaia-lab-api:/app/apps/api/.ms.mts
docker exec -w /app/apps/api operaia-lab-api npx tsx ./.ms.mts 2>&1 | tail -5
