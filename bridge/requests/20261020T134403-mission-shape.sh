cat > /tmp/ms.mts <<"X"
import { prisma } from "@operaia/database";
const rows = await prisma.mission.findMany({ where: { status: "COMPLETED" }, orderBy: { finishedAt: "desc" }, take: 4, select: { id: true, parentMissionId: true, ownerEmployeeId: true, missionKind: true, objective: true, resultJson: true } });
for (const r of rows) {
  const j = r.resultJson as any;
  const shape = (o: any, d = 0): any => o && typeof o === "object" && d < 2 ? Object.fromEntries(Object.entries(o).slice(0, 12).map(([k, v]) => [k, typeof v === "string" ? `str(${(v as string).length})` : Array.isArray(v) ? `arr(${v.length})` : shape(v, d + 1)])) : typeof o;
  console.log(JSON.stringify({ kind: r.missionKind, owner: r.ownerEmployeeId, child: !!r.parentMissionId, obj: r.objective.slice(0, 50), shape: shape(j) }));
}
const counts = await prisma.mission.groupBy({ by: ["status"], where: { parentMissionId: null, updatedAt: { gte: new Date(Date.now() - 86400000) } }, _count: true });
console.log(JSON.stringify(counts));
await prisma.$disconnect();
X
docker cp /tmp/ms.mts operaia-lab-api:/app/apps/api/.ms.mts
docker exec -w /app/apps/api operaia-lab-api npx tsx ./.ms.mts 2>&1 | tail -8
