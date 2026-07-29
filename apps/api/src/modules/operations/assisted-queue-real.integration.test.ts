/**
 * ADR-007 Fase 2.2c — validacao real MissionQueue (Prisma + workers).
 * Sem mocks de fila. Skip automatico se Postgres/NEXO indisponivel.
 */
import "./ensure-database-url.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@operaia/database";
import {
  createRealAssistedQueueBundle,
  disposeRealAssistedQueueBundle,
  probeRealQueueReady,
  runAssistedMissionOnRealQueue,
  type RealAssistedQueueBundle,
} from "./assisted-queue-real-harness.js";

const READY = await probeRealQueueReady();

describe.skipIf(!READY.ok)("ADR-007 Fase 2.2c — Assisted MissionQueue real", () => {
  let bundle: RealAssistedQueueBundle;

  beforeAll(async () => {
    bundle = await createRealAssistedQueueBundle();
  }, 60_000);

  afterAll(async () => {
    if (bundle) {
      await disposeRealAssistedQueueBundle(bundle);
    }
  }, 30_000);

  it(
    "run() com preferQueue=true executa COORDINATE→EXECUTE→CONSOLIDATE no Prisma",
    async () => {
      const objective = `2.2c vitest autenticacao ${Date.now()}`;
      const { run, evidence, orchestratorCalled } =
        await runAssistedMissionOnRealQueue({ bundle, objective });

      expect(orchestratorCalled).toBe(false);
      expect(bundle.service.prefersQueue).toBe(true);

      expect(run.id).toBe(evidence.rootMissionId);
      expect(run.status).toBe("completed");
      expect(run.usableResult.length).toBeGreaterThan(0);
      expect(run.reply.answer.summary.length).toBeGreaterThan(0);
      expect(run.mission.initial.output.decision).toBeDefined();
      expect(run.mission.final.output.decision).toBeDefined();

      expect(evidence.rootStatus).toBe("COMPLETED");
      expect(evidence.rootOwnerEmployeeId).toBe("operaia-ceo");
      expect(evidence.rootHasInitial).toBe(true);
      expect(evidence.rootHasFinal).toBe(true);

      const root = await prisma.mission.findUniqueOrThrow({
        where: { id: run.id },
      });
      expect(root.missionKind).toBe("COORDINATE");
      expect(root.status).toBe("COMPLETED");

      expect(evidence.executeChildren.length).toBeGreaterThan(0);
      expect(
        evidence.executeChildren.every((c) => c.status === "COMPLETED"),
      ).toBe(true);

      const claimedOrCompleted = evidence.eventTypes.some((t) =>
        ["claimed", "completed", "enqueued", "waiting"].includes(t),
      );
      expect(claimedOrCompleted).toBe(true);

      expect(evidence.learningOnRoot).toBe(true);
      expect(evidence.memoryHits).toBeGreaterThanOrEqual(0);

      if (evidence.executeChildren.some((c) => c.status === "COMPLETED")) {
        expect(
          evidence.consolidateChildren.some((c) => c.status === "COMPLETED"),
        ).toBe(true);
        expect(run.mission.outcomes.length).toBeGreaterThan(0);
      }
    },
    180_000,
  );
});

describe("ADR-007 Fase 2.2c — probe ambiente", () => {
  it("reporta motivo quando ambiente real nao esta pronto", () => {
    if (READY.ok) {
      expect(READY.nexoId).toBeTruthy();
      return;
    }
    expect(READY.reason).toBeTruthy();
    console.warn(`[2.2c] skip suite real: ${READY.reason}`);
  });
});
