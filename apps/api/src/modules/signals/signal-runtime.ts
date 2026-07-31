/**
 * Composition do Domain Signal runtime (GitHub webhook + ingest).
 */
import {
  createPlatformBridgeRegistry,
  DomainSignalIngestService,
  DomainSignalService,
  GitHubSourceBridge,
  InternalSourceBridge,
} from "@operaia/domain-signals";
import { PrismaDomainSignalStore } from "./prisma-domain-signal-store.js";

export interface SignalRuntime {
  readonly store: PrismaDomainSignalStore;
  readonly signals: DomainSignalService;
  readonly bridge: GitHubSourceBridge;
  readonly ingest: DomainSignalIngestService;
}

export function createSignalRuntime(): SignalRuntime {
  const store = new PrismaDomainSignalStore();
  const signals = new DomainSignalService(store);
  const bridge = new GitHubSourceBridge();
  const ingest = new DomainSignalIngestService({
    registry: createPlatformBridgeRegistry({
      internal: new InternalSourceBridge(),
      github: bridge,
    }),
    signals,
  });
  return { store, signals, bridge, ingest };
}
