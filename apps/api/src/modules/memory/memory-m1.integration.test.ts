/**
 * Memory M1.1 — PrismaOperationalMemoryStore + briefing + isolamento + TTL + backfill.
 * Skip se Postgres indisponivel.
 */
import "../operations/ensure-database-url.js";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  MEMORY_KIND_ORG_LEARNING,
  MEMORY_KIND_RUN_SUMMARY,
  MEMORY_LAYER_OPERATIONAL,
  MEMORY_ORIGIN_PERSIST_MISSION,
  MEMORY_SOURCE_LEARNING,
  MEMORY_SOURCE_MISSION,
  MemoryWorkspaceRequiredError,
} from "@operaia/memory";
import { prisma } from "@operaia/database";
import { backfillOperationalMemory } from "./backfill-operational-memory.js";
import { PrismaOperationalMemoryStore } from "./prisma-operational-memory-store.js";
import {
  loadMissionMemoryNotes,
  persistMissionMemory,
} from "../operations/mission-memory.js";
import { createLabRuntime } from "../operations/lab-runtime.js";
import { probeRealQueueReady } from "../operations/assisted-queue-real-harness.js";

const READY = await probeRealQueueReady();

describe.skipIf(!READY.ok)("Memory M1.1 — PrismaOperationalMemoryStore", () => {
  const store = new PrismaOperationalMemoryStore();
  const workspaceA = `m1-ws-a-${randomUUID().slice(0, 8)}`;
  const workspaceB = `m1-ws-b-${randomUUID().slice(0, 8)}`;

  afterAll(async () => {
    await prisma.operationalMemoryNote.deleteMany({
      where: {
        workspaceId: { in: [workspaceA, workspaceB] },
      },
    });
    await prisma.$disconnect();
  });

  it("persiste note com sourceType/sourceId/origin e recupera apos search", async () => {
    const missionId = randomUUID();
    await persistMissionMemory(store, {
      workspaceId: workspaceA,
      missionId,
      objective: "autenticacao M1 persistencia",
      summary: "Resumo outcome M1 — sessao + JWT",
      statusFinal: "COMPLETED",
      decision: "delegar Mag",
    });

    const row = await prisma.operationalMemoryNote.findUniqueOrThrow({
      where: {
        workspaceId_sourceType_sourceId_kind: {
          workspaceId: workspaceA,
          sourceType: MEMORY_SOURCE_MISSION,
          sourceId: missionId,
          kind: MEMORY_KIND_RUN_SUMMARY,
        },
      },
    });

    expect(row.layer).toBe(MEMORY_LAYER_OPERATIONAL);
    expect(row.origin).toBe(MEMORY_ORIGIN_PERSIST_MISSION);
    expect(row.sourceType).toBe(MEMORY_SOURCE_MISSION);
    expect(row.sourceId).toBe(missionId);
    expect(row.statusFinal).toBe("COMPLETED");
    expect(row.content).toContain("sessao + JWT");

    const hit = await store.search({
      text: "autenticacao M1 persistencia",
      topK: 5,
      filter: { workspaceId: workspaceA },
    });
    expect(hit.length).toBeGreaterThan(0);
    expect(hit[0]?.record.metadata?.sourceId).toBe(missionId);
    expect(hit[0]?.record.metadata?.origin).toBe(MEMORY_ORIGIN_PERSIST_MISSION);
  });

  it("isolamento: workspace A nao ve notes de B", async () => {
    const idA = randomUUID();
    const idB = randomUUID();
    await persistMissionMemory(store, {
      workspaceId: workspaceA,
      missionId: idA,
      objective: "segredo workspace A isolamento",
      summary: "conteudo exclusivo A",
    });
    await persistMissionMemory(store, {
      workspaceId: workspaceB,
      missionId: idB,
      objective: "segredo workspace B isolamento",
      summary: "conteudo exclusivo B",
    });

    const fromA = await store.search({
      text: "segredo",
      topK: 10,
      filter: { workspaceId: workspaceA },
    });
    const fromB = await store.search({
      text: "segredo",
      topK: 10,
      filter: { workspaceId: workspaceB },
    });

    expect(fromA.every((r) => r.record.metadata?.workspaceId === workspaceA)).toBe(
      true,
    );
    expect(fromB.every((r) => r.record.metadata?.workspaceId === workspaceB)).toBe(
      true,
    );
    expect(fromA.some((r) => r.record.content.includes("exclusivo B"))).toBe(
      false,
    );
    expect(fromB.some((r) => r.record.content.includes("exclusivo A"))).toBe(
      false,
    );
  });

  it("search sem workspaceId falha (isolamento hard)", async () => {
    await expect(
      store.search({ text: "qualquer", topK: 3 }),
    ).rejects.toBeInstanceOf(MemoryWorkspaceRequiredError);
  });

  it("TTL: note expirada nao aparece no search", async () => {
    const missionId = randomUUID();
    const past = new Date(Date.now() - 60_000).toISOString();
    await store.store({
      id: randomUUID(),
      content:
        "Workspace: ttl\nObjetivo: missao expirada ttl-m1\nResumo: deve sumir",
      metadata: {
        workspaceId: workspaceA,
        layer: MEMORY_LAYER_OPERATIONAL,
        kind: MEMORY_KIND_RUN_SUMMARY,
        sourceType: MEMORY_SOURCE_MISSION,
        sourceId: missionId,
        origin: MEMORY_ORIGIN_PERSIST_MISSION,
        missionId,
        expiresAt: past,
      },
    });

    const hits = await store.search({
      text: "ttl-m1",
      topK: 10,
      filter: { workspaceId: workspaceA },
    });
    expect(hits.every((h) => h.record.metadata?.sourceId !== missionId)).toBe(
      true,
    );
  });

  it("leitura no briefing: notes M1 entram em memoryContext", async () => {
    const memory = new PrismaOperationalMemoryStore();
    await persistMissionMemory(memory, {
      workspaceId: "nexo",
      missionId: randomUUID(),
      objective: "autenticacao",
      summary: "Decisao previa M1 — usar sessao + JWT no NEXO briefing",
    });

    const lab = createLabRuntime({
      deterministic: true,
      memoryStore: memory,
    });

    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: "Quero adicionar autenticacao ao NEXO.",
      employeeId: "operaia-ceo",
    });

    const ceoMemory = run.mission.initial.briefing.additional?.memoryContext as
      | readonly string[]
      | undefined;
    expect(ceoMemory).toBeDefined();
    expect(
      ceoMemory!.some((note) => note.includes("sessao + JWT") || note.includes("JWT")),
    ).toBe(true);

    const notes = await loadMissionMemoryNotes(memory, {
      workspaceId: "nexo",
      objective: "autenticacao",
    });
    expect(notes.length).toBeGreaterThan(0);
  });

  it("upsert idempotente: mesmo source nao duplica linha", async () => {
    const missionId = randomUUID();
    await persistMissionMemory(store, {
      workspaceId: workspaceA,
      missionId,
      objective: "idempotente m1",
      summary: "v1",
    });
    await persistMissionMemory(store, {
      workspaceId: workspaceA,
      missionId,
      objective: "idempotente m1",
      summary: "v2 atualizado",
    });

    const count = await prisma.operationalMemoryNote.count({
      where: {
        workspaceId: workspaceA,
        sourceType: MEMORY_SOURCE_MISSION,
        sourceId: missionId,
        kind: MEMORY_KIND_RUN_SUMMARY,
      },
    });
    expect(count).toBe(1);

    const row = await prisma.operationalMemoryNote.findFirstOrThrow({
      where: { sourceId: missionId, workspaceId: workspaceA },
    });
    expect(row.content).toContain("v2 atualizado");
  });

  it("backfill idempotente a partir de MissionLearning", async () => {
    const missionId = randomUUID();
    const learningId = randomUUID();
    const stamp = Date.now();

    await prisma.mission.create({
      data: {
        id: missionId,
        workspaceId: workspaceA,
        objective: `Backfill learning objective ${stamp}`,
        objectiveHash: `bf-${stamp}`,
        missionKind: "COORDINATE",
        status: "COMPLETED",
        ownerEmployeeId: "operaia-ceo",
        finishedAt: new Date(),
        resultJson: {
          phase: "consolidated",
          usableResult: `usable backfill ${stamp}`,
        },
      },
    });

    await prisma.missionLearning.create({
      data: {
        id: learningId,
        missionId,
        workspaceId: workspaceA,
        context: `Backfill learning objective ${stamp}`,
        decision: "delegar",
        justification: "teste",
        result: "ok",
        lessonsLearned: `licao backfill ${stamp}`,
        risksFound: ["risco-x"],
        reuseWhen: "auth",
        avoidWhen: "chat",
      },
    });

    const first = await backfillOperationalMemory({
      memory: store,
      workspaceId: workspaceA,
      maxAgeDays: 90,
    });
    expect(first.learningCreated).toBeGreaterThanOrEqual(1);
    expect(first.missionCreated).toBeGreaterThanOrEqual(1);

    const second = await backfillOperationalMemory({
      memory: store,
      workspaceId: workspaceA,
      maxAgeDays: 90,
    });
    expect(second.learningCreated).toBe(0);
    expect(second.missionCreated).toBe(0);
    expect(second.learningSkipped).toBeGreaterThanOrEqual(1);
    expect(second.missionSkipped).toBeGreaterThanOrEqual(1);

    const learningNotes = await prisma.operationalMemoryNote.count({
      where: {
        workspaceId: workspaceA,
        sourceType: MEMORY_SOURCE_LEARNING,
        sourceId: learningId,
        kind: MEMORY_KIND_ORG_LEARNING,
      },
    });
    expect(learningNotes).toBe(1);

    await prisma.missionLearning.delete({ where: { id: learningId } });
    await prisma.mission.delete({ where: { id: missionId } });
  });
});

describe("Memory M1.1 — probe", () => {
  it("reporta skip quando DB ausente", () => {
    if (READY.ok) {
      expect(READY.nexoId).toBeTruthy();
      return;
    }
    expect(READY.reason).toBeTruthy();
  });
});
