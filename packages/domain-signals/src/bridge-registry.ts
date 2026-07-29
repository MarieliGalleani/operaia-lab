/**
 * Registry de SourceBridge por sourceType.
 */
import type { BridgeCapabilities, SourceBridge } from "./source-bridge.js";

export class BridgeRegistry {
  private readonly bridges = new Map<string, SourceBridge>();

  register(bridge: SourceBridge): void {
    const key = bridge.sourceType.trim();
    if (!key) {
      throw new Error("BridgeRegistry.register exige sourceType");
    }
    if (this.bridges.has(key)) {
      throw new Error(
        `BridgeRegistry: sourceType duplicado: ${key}`,
      );
    }
    if (bridge.capabilities.sourceType !== key) {
      throw new Error(
        `BridgeRegistry: capabilities.sourceType diverge de bridge.sourceType (${bridge.capabilities.sourceType} vs ${key})`,
      );
    }
    this.bridges.set(key, bridge);
  }

  get(sourceType: string): SourceBridge | undefined {
    return this.bridges.get(sourceType);
  }

  list(): readonly SourceBridge[] {
    return [...this.bridges.values()];
  }

  assertCapability(
    sourceType: string,
    capability: keyof Omit<BridgeCapabilities, "sourceType">,
  ): void {
    const bridge = this.bridges.get(sourceType);
    if (!bridge) {
      throw new Error(`Bridge desconhecido: ${sourceType}`);
    }
    if (!bridge.capabilities[capability]) {
      throw new Error(
        `Bridge ${sourceType} nao declara capability: ${capability}`,
      );
    }
  }

  has(sourceType: string): boolean {
    return this.bridges.has(sourceType);
  }
}

/** Registry padrao S2: apenas InternalSourceBridge. */
export function createDefaultBridgeRegistry(
  internalBridge: SourceBridge,
): BridgeRegistry {
  const registry = new BridgeRegistry();
  registry.register(internalBridge);
  return registry;
}

/** Registry plataforma S3.1: internal + github. */
export function createPlatformBridgeRegistry(input: {
  readonly internal: SourceBridge;
  readonly github: SourceBridge;
}): BridgeRegistry {
  const registry = new BridgeRegistry();
  registry.register(input.internal);
  registry.register(input.github);
  return registry;
}
