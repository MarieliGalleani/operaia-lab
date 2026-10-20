cat > /tmp/ms.mts <<"X"
import { prisma } from "@operaia/database";
const r = await prisma.mission.findFirst({ where: { objective: { contains: "[HUMAN_DEMAND]" }, status: "COMPLETED", ownerEmployeeId: { not: "operaia-ceo" } }, orderBy: { finishedAt: "desc" }, select: { resultJson: true, parentMissionId: true } });
const j = r?.resultJson as any;
const cut = (o: any, d = 0): any => typeof o === "string" ? o.slice(0, 160) : Array.isArray(o) ? o.slice(0, 2).map((x) => cut(x, d + 1)) : o && typeof o === "object" && d < 3 ? Object.fromEntries(Object.entries(o).slice(0, 10).map(([k, v]) => [k, cut(v, d + 1)])) : o;
console.log(JSON.stringify({ delivery: cut(j?.delivery), employeeResult: cut(j?.employeeResult) }).slice(0, 2500));
const p = await prisma.mission.findFirst({ where: { id: r!.parentMissionId! }, select: { parentMissionId: true, objective: true } });
console.log(JSON.stringify(p).slice(0, 200));
await prisma.$disconnect();
X
docker cp /tmp/ms.mts operaia-lab-api:/app/apps/api/.ms.mts
docker exec -w /app/apps/api operaia-lab-api npx tsx ./.ms.mts 2>&1 | tail -3
