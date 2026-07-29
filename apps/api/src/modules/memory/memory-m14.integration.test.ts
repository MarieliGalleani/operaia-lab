/**
 * Memory M1.4 — caminho unificado de leitura (MemoryStore → OperationalMemoryNote).
 * Sem dual-read MissionLearning no briefing (salvo fallback opt-in).
 */
import "../operations/ensure-database-url.js";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  MEMORY_KIND_ORG_LEARNING,
  MEMORY_KIND_RUN_SUMMARY,
  MEMORY_LAYER_OPERATIONAL,
  MEMORY_ORIGIN_PERSIST_MISSION,
  MEMORY_ORIGIN_RECORD_LEARNING,
  MEMORY_SOURCE_LEARNING,
  MEMORY_SOURCE_MISSION,
} from "@operaia/memory";
import { prisma } from "@operaia/database";
import { PrismaOperationalMemoryStore } from "./prisma-operational-memory-store.js";
import {
  loadOperationalMemoryNotes,
  persistMissionMemory,
} from "../operations/mission-memory.js";
import {
  loadOrganizationalLearningNotes,
  loadOrganizationalLearningNotesFromPrisma,
  recordMissionLearning,
} from "../organization/mission-learning.js";
import { createLabRuntime } from "../operations/lab-runtime.js";
import { probeRealQueueReady } from "../operations/assisted-queue-real-harness.js";

const READY = await probeRealQueueReady();

describe.skipIf(!READY.ok)("Memory M1.4 — Unified Memory Read Path", () => {
  const store = new PrismaOperationalMemoryStore();
  const workspaceA = `m14-ws-a-${randomUUID().slice(0, 8)}`;
  const workspaceB = `m14-ws-b-${randomUUID().slice(0, 8)}`;

  afterAll(async () => {
    await prisma.operationalMemoryNote.deleteMany({
      where: { workspaceId: { in: [workspaceA, workspaceB, "nexo"] } },
    });
    await prisma.$disconnect();
  });

  it("leitura apos restart: notes sobrevivem em nova instancia do store", async () => {
    const missionId = randomUUID();
    await persistMissionMemory(store, {
      workspaceId: workspaceA,
      missionId,
      objective: "restart m14 autenticacao",
      summary: "resumo sobrevive restart M1.4",
      statusFinal: "COMPLETED",
    });

    const storeAfterRestart = new PrismaOperationalMemoryStore();
    const notes = await loadOperationalMemoryNotes(storeAfterRestart, {
      workspaceId: workspaceA,
      objective: "restart m14 autenticacao",
    });

    expect(notes.some((n) => n.includes("sobrevive restart M1.4"))).toBe(true);
    expect(
      notes.every((n) => !n.includes("workspace B") || n.includes(workspaceA)),
    ).toBe(true);
  });

  it("leitura por workspace: isolamento sem vazamento", async () => {
    const idA = randomUUID();
    const idB = randomUUID();
    await persistMissionMemory(store, {
      workspaceId: workspaceA,
      missionId: idA,
      objective: "isolamento m14 alpha",
      summary: "conteudo exclusivo alpha",
    });
    await persistMissionMemory(store, {
      workspaceId: workspaceB,
      missionId: idB,
      objective: "isolamento m14 beta",
      summary: "conteudo exclusivo beta",
    });

    const notesA = await loadOperationalMemoryNotes(store, {
      workspaceId: workspaceA,
      objective: "isolamento m14",
    });
    const notesB = await loadOperationalMemoryNotes(store, {
      workspaceId: workspaceB,
      objective: "isolamento m14",
    });

    expect(notesA.some((n) => n.includes("exclusivo alpha"))).toBe(true);
    expect(notesA.some((n) => n.includes("exclusivo beta"))).toBe(false);
    expect(notesB.some((n) => n.includes("exclusivo beta"))).toBe(true);
    expect(notesB.some((n) => n.includes("exclusivo alpha"))).toBe(false);
  });

  it("ausencia de duplicatas: summary + learning do mesmo fluxo sem dual-read", async () => {
    const missionId = randomUUID();
    await prisma.mission.create({
      data: {
        id: missionId,
        workspaceId: workspaceA,
        objective: "dedupe m14 auth",
        objectiveHash: `dedupe-${Date.now()}`,
        missionKind: "COORDINATE",
        status: "COMPLETED",
        ownerEmployeeId: "operaia-ceo",
        finishedAt: new Date(),
      },
    });

    await persistMissionMemory(store, {
      workspaceId: workspaceA,
      missionId,
      objective: "dedupe m14 auth",
      summary: "outcome dedupe m14",
    });
    await recordMissionLearning(store, {
      missionId,
      workspaceId: workspaceA,
      objective: "dedupe m14 auth",
      decision: "delegar Mag",
      justification: "teste",
      result: "ok",
      lessonsLearned: "licao dedupe m14 unica",
      reuseWhen: "auth",
      avoidWhen: "chat",
    });

    const notes = await loadOperationalMemoryNotes(store, {
      workspaceId: workspaceA,
      objective: "dedupe m14 auth",
      topK: 10,
    });

    const learningNotes = notes.filter((n) => n.includes("licao dedupe m14"));
    expect(learningNotes.length).toBe(1);
    expect(notes.filter((n) => n.includes("outcome dedupe m14")).length).toBe(1);

    const learningsOnly = await loadOrganizationalLearningNotes(store, {
      workspaceId: workspaceA,
      objective: "dedupe m14 auth",
      allowPrismaFallback: false,
    });
    expect(learningsOnly.length).toBe(1);
    expect(learningsOnly[0]).toContain("[LEARNING]licao dedupe m14 unica");

    await prisma.missionLearning.deleteMany({ where: { missionId } });
    await prisma.mission.delete({ where: { id: missionId } });
  });

  it("compatibilidade com briefing dos employees", async () => {
    await persistMissionMemory(store, {
      workspaceId: "nexo",
      missionId: randomUUID(),
      objective: "autenticacao",
      summary: "Decisao M1.4 — sessao + JWT no briefing unificado",
    });
    await store.store({
      id: randomUUID(),
      content: [
        "Workspace: nexo",
        "Objetivo: autenticacao",
        "Decisao: delegar",
        "Resultado: ok",
        "Licao: preferir JWT curto",
        "Reutilizar quando: auth",
      ].join("\n"),
      metadata: {
        workspaceId: "nexo",
        layer: MEMORY_LAYER_OPERATIONAL,
        kind: MEMORY_KIND_ORG_LEARNING,
        sourceType: MEMORY_SOURCE_LEARNING,
        sourceId: randomUUID(),
        origin: MEMORY_ORIGIN_RECORD_LEARNING,
      },
    });

    const lab = createLabRuntime({
      deterministic: true,
      memoryStore: store,
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
      ceoMemory!.some(
        (n) => n.includes("JWT") || n.includes("sessao") || n.includes("LEARNING"),
      ),
    ).toBe(true);

    const mag = run.mission.outcomes.find((o) => o.employeeId === "cto-mag");
    const magMemory = mag?.result?.briefing.additional?.memoryContext as
      | readonly string[]
      | undefined;
    expect(magMemory).toBeDefined();
  });

  it("fallback Prisma so quando allowLearningPrismaFallback=true e indice vazio", async () => {
    const emptyWs = `m14-empty-${randomUUID().slice(0, 8)}`;
    const missionId = randomUUID();

    await prisma.mission.create({
      data: {
        id: missionId,
        workspaceId: emptyWs,
        objective: "fallback only ledger",
        objectiveHash: `fb-${Date.now()}`,
        missionKind: "COORDINATE",
        status: "COMPLETED",
        ownerEmployeeId: "operaia-ceo",
        finishedAt: new Date(),
      },
    });
    await prisma.missionLearning.create({
      data: {
        missionId,
        workspaceId: emptyWs,
        context: "fallback only ledger",
        decision: "x",
        justification: "y",
        result: "z",
        lessonsLearned: "licao so no ledger prisma",
      },
    });

    const withoutFallback = await loadOperationalMemoryNotes(store, {
      workspaceId: emptyWs,
      objective: "fallback only ledger",
      allowLearningPrismaFallback: false,
    });
    expect(withoutFallback.some((n) => n.includes("so no ledger"))).toBe(false);

    const withFallback = await loadOperationalMemoryNotes(store, {
      workspaceId: emptyWs,
      objective: "fallback only ledger",
      allowLearningPrismaFallback: true,
      learningPrismaFallback: loadOrganizationalLearningNotesFromPrisma,
    });
    expect(withFallback.some((n) => n.includes("so no ledger prisma"))).toBe(
      true,
    );

    await prisma.missionLearning.deleteMany({ where: { missionId } });
    await prisma.mission.delete({ where: { id: missionId } });
    await prisma.operationalMemoryNote.deleteMany({
      where: { workspaceId: emptyWs },
    });
  });

  it("metadados de rastreio presentes no indice unificado", async () => {
    const missionId = randomUUID();
    await persistMissionMemory(store, {
      workspaceId: workspaceA,
      missionId,
      objective: "trace m14",
      summary: "trace summary",
    });

    const hits = await store.search({
      text: "trace m14",
      topK: 5,
      filter: {
        workspaceId: workspaceA,
        kind: MEMORY_KIND_RUN_SUMMARY,
      },
    });
    expect(hits[0]?.record.metadata?.sourceType).toBe(MEMORY_SOURCE_MISSION);
    expect(hits[0]?.record.metadata?.sourceId).toBe(missionId);
    expect(hits[0]?.record.metadata?.origin).toBe(MEMORY_ORIGIN_PERSIST_MISSION);
  });
});

describe("Memory M1.4 — probe", () => {
  it("reporta skip quando DB ausente", () => {
    if (READY.ok) {
      expect(READY.nexoId).toBeTruthy();
      return;
    }
    expect(READY.reason).toBeTruthy();
  });
});
