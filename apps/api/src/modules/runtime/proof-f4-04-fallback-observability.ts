/**
 * Validacao controlada F4-04 — fallback observavel com missionId.
 * Nao altera .env. Nao reinicia servicos.
 * Simula falha Gemini (provider nomeado "gemini") → deterministic.
 */
import "../operations/ensure-database-url.js";
import {
  DeterministicLLMProvider,
  FallbackLLMProvider,
  composeLLMObservers,
  RecordingLLMObserver,
  runWithLLMExecutionContext,
  type LLMCompletion,
  type LLMProvider,
} from "@operaia/ai-core";
import { prisma } from "@operaia/database";
import {
  LLM_FALLBACK_MISSION_EVENT_TYPE,
  MissionFallbackLLMObserver,
} from "./mission-llm-fallback-observer.js";
import { MissionQueue } from "./mission-queue.js";
import { CEO_EMPLOYEE_ID } from "./mission-states.js";

const MARKER = `F4-04-fallback-validation ${Date.now()}`;

class ControlledFailingGemini implements LLMProvider {
  readonly name = "gemini";
  async complete(): Promise<LLMCompletion> {
    throw new Error("controlled_validation:gemini_unavailable");
  }
}

async function main(): Promise<void> {
  const queue = new MissionQueue();
  const recording = new RecordingLLMObserver();
  const fallbackObserver = new MissionFallbackLLMObserver({ sink: queue });
  const llm = new FallbackLLMProvider(
    [new ControlledFailingGemini(), new DeterministicLLMProvider()],
    composeLLMObservers(recording, fallbackObserver),
  );

  const { mission } = await queue.enqueue({
    workspaceId: "operaia-lab",
    objective: MARKER,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    dedupe: false,
  });

  const claimed = await queue.claim({
    employeeId: CEO_EMPLOYEE_ID,
    specialization: "MANAGEMENT",
  });
  if (!claimed || claimed.id !== mission.id) {
    throw new Error(
      `Claim inesperado: claimed=${claimed?.id ?? "null"} expected=${mission.id}`,
    );
  }

  const result = await runWithLLMExecutionContext(
    {
      missionId: claimed.id,
      correlationId: claimed.id,
    },
    async () => llm.complete([{ role: "user", content: MARKER }]),
  );
  await fallbackObserver.flush();

  await queue.complete(
    claimed.id,
    {
      phase: "f4-04-validation",
      marker: MARKER,
      llmPreview: result.content.slice(0, 120),
      fallback: true,
    },
    claimed.leaseVersion,
  );

  const events = await prisma.missionEvent.findMany({
    where: {
      missionId: claimed.id,
      type: LLM_FALLBACK_MISSION_EVENT_TYPE,
    },
    orderBy: { createdAt: "asc" },
  });
  const terminal = await prisma.mission.findUniqueOrThrow({
    where: { id: claimed.id },
  });
  const open = await prisma.mission.groupBy({
    by: ["status"],
    where: { status: { in: ["RUNNING", "QUEUED", "WAITING"] } },
    _count: true,
  });

  console.log(
    JSON.stringify(
      {
        ok: events.length >= 1 && terminal.status === "COMPLETED",
        missionId: claimed.id,
        marker: MARKER,
        missionStatus: terminal.status,
        fallbackEvents: events.map((event) => ({
          type: event.type,
          message: event.message,
          payload: event.payload,
        })),
        recordingFallback: recording
          .snapshot()
          .filter((event) => event.type === "fallback_used"),
        openQueue: open,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
  if (events.length < 1 || terminal.status !== "COMPLETED") {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
