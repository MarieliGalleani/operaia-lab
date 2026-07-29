import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BridgeRegistry,
  createDefaultBridgeRegistry,
  InternalSourceBridge,
  INTERNAL_SOURCE_TYPE,
  buildInternalIngressEvent,
} from "./index.js";

describe("BridgeRegistry", () => {
  it("register / get / list", () => {
    const registry = new BridgeRegistry();
    const bridge = new InternalSourceBridge();
    registry.register(bridge);
    expect(registry.get(INTERNAL_SOURCE_TYPE)).toBe(bridge);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]?.sourceType).toBe("internal");
  });

  it("rejeita sourceType duplicado", () => {
    const registry = createDefaultBridgeRegistry(new InternalSourceBridge());
    expect(() => registry.register(new InternalSourceBridge())).toThrow(
      /duplicado/,
    );
  });

  it("assertCapability exige capability verdadeira", () => {
    const registry = createDefaultBridgeRegistry(new InternalSourceBridge());
    expect(() =>
      registry.assertCapability("internal", "supportsRedaction"),
    ).not.toThrow();
    expect(() =>
      registry.assertCapability("internal", "requiresHmac"),
    ).toThrow(/capability/);
  });
});

describe("InternalSourceBridge", () => {
  it("validate + prepare redige payload", async () => {
    const bridge = new InternalSourceBridge();
    const event = buildInternalIngressEvent({
      workspaceId: "ws-1",
      externalRef: "lab/probe",
      deliveryId: "d-1",
      type: "lab.probe",
      payload: { title: "ok", token: "secret" },
      correlationId: "corr-1",
    });
    expect(bridge.validateContext(event).ok).toBe(true);
    const prepared = await bridge.prepare(event);
    expect(prepared.workspaceId).toBe("ws-1");
    expect(prepared.payloadRedacted.token).toBe("[REDACTED]");
    expect(prepared.correlationId).toBe("corr-1");
  });

  it("rejeita auth invalido", () => {
    const bridge = new InternalSourceBridge();
    const event = buildInternalIngressEvent({
      workspaceId: "ws-1",
      externalRef: "lab/probe",
      deliveryId: "d-1",
      type: "lab.probe",
      payload: {},
    });
    const bad = {
      ...event,
      auth: { kind: "internal" as const, callerId: "", workspaceId: "ws-1" },
    };
    const result = bridge.validateContext(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("auth_failed");
    }
  });
});

describe("bridge architecture — sem fila", () => {
  it("arquivos de bridge/ingest nao referenciam simbolos de execucao", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)));
    const targets = [
      "source-bridge.ts",
      "bridge-registry.ts",
      "internal-source-bridge.ts",
      "domain-signal-ingest-service.ts",
      "normalized-ingress.ts",
      "ingest-observability.ts",
    ];
    const forbidden = [
      "MissionQueue",
      "QueuedMissionExecutor",
      "MissionOrchestrator",
      "DelegationService",
      "ExecutionEngine",
    ];
    for (const name of targets) {
      const text = readFileSync(join(root, name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const needle of forbidden) {
        expect(text.includes(needle), `${name} → ${needle}`).toBe(false);
      }
    }
  });

  it("package nao importa mission-queue / execution-engine", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)));
    const files = listTs(root);
    for (const file of files) {
      if (file.endsWith(".test.ts")) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/from\s+["'][^"']*mission-queue/);
      expect(text).not.toMatch(/from\s+["']@operaia\/execution-engine/);
    }
  });
});

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listTs(full));
    } else if (name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}
