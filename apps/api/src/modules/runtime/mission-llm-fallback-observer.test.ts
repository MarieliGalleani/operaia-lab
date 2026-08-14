/**
 * F4-04 — MissionFallbackLLMObserver persiste fallback_used via sink oficial.
 */
import { describe, expect, it, vi } from "vitest";
import {
  FallbackLLMProvider,
  DeterministicLLMProvider,
  RecordingLLMObserver,
  composeLLMObservers,
  runWithLLMExecutionContext,
  type LLMCompletion,
  type LLMProvider,
} from "@operaia/ai-core";
import {
  LLM_FALLBACK_MISSION_EVENT_TYPE,
  MissionFallbackLLMObserver,
} from "./mission-llm-fallback-observer.js";

class FailingGemini implements LLMProvider {
  readonly name = "gemini";
  async complete(): Promise<LLMCompletion> {
    throw new Error("controlled_validation:gemini_unavailable");
  }
}

describe("MissionFallbackLLMObserver", () => {
  it("Caso 1 — fallback sem Mission nao persiste MissionEvent", async () => {
    const appendEvent = vi.fn(async () => undefined);
    const missionObserver = new MissionFallbackLLMObserver({
      sink: { appendEvent },
    });
    const recording = new RecordingLLMObserver();
    const llm = new FallbackLLMProvider(
      [new FailingGemini(), new DeterministicLLMProvider()],
      composeLLMObservers(recording, missionObserver),
    );

    await llm.complete([{ role: "user", content: "sem missao" }]);

    expect(
      recording.snapshot().some((event) => event.type === "fallback_used"),
    ).toBe(true);
    expect(appendEvent).not.toHaveBeenCalled();
  });

  it("Caso 2+3 — fallback com Mission persiste llm_fallback_used no sink", async () => {
    const appendEvent = vi.fn(async () => undefined);
    const missionObserver = new MissionFallbackLLMObserver({
      sink: { appendEvent },
    });
    const recording = new RecordingLLMObserver();
    const llm = new FallbackLLMProvider(
      [new FailingGemini(), new DeterministicLLMProvider()],
      composeLLMObservers(recording, missionObserver),
    );

    await runWithLLMExecutionContext(
      {
        missionId: "mission-f4-04",
        correlationId: "corr-f4-04",
      },
      async () => {
        await llm.complete([{ role: "user", content: "com missao" }]);
      },
    );

    const fallback = recording
      .snapshot()
      .find((event) => event.type === "fallback_used");
    expect(fallback).toMatchObject({
      type: "fallback_used",
      fromProvider: "gemini",
      toProvider: "deterministic",
      missionId: "mission-f4-04",
      correlationId: "corr-f4-04",
    });

    await missionObserver.flush();

    expect(appendEvent).toHaveBeenCalledTimes(1);
    expect(appendEvent).toHaveBeenCalledWith(
      "mission-f4-04",
      LLM_FALLBACK_MISSION_EVENT_TYPE,
      "LLM fallback gemini -> deterministic",
      expect.objectContaining({
        type: "fallback_used",
        fromProvider: "gemini",
        toProvider: "deterministic",
        correlationId: "corr-f4-04",
        reason: "controlled_validation:gemini_unavailable",
      }),
    );
  });

  it("bindSink tardio habilita persistencia apos bootstrap", async () => {
    const appendEvent = vi.fn(async () => undefined);
    const missionObserver = new MissionFallbackLLMObserver();
    const llm = new FallbackLLMProvider(
      [new FailingGemini(), new DeterministicLLMProvider()],
      missionObserver,
    );

    await runWithLLMExecutionContext({ missionId: "m-1" }, async () => {
      await llm.complete([{ role: "user", content: "antes" }]);
    });
    expect(appendEvent).not.toHaveBeenCalled();

    missionObserver.bindSink({ appendEvent });
    await runWithLLMExecutionContext({ missionId: "m-2" }, async () => {
      await llm.complete([{ role: "user", content: "depois" }]);
    });
    await missionObserver.flush();

    expect(appendEvent).toHaveBeenCalledWith(
      "m-2",
      LLM_FALLBACK_MISSION_EVENT_TYPE,
      expect.any(String),
      expect.objectContaining({ fromProvider: "gemini" }),
    );
  });
});
