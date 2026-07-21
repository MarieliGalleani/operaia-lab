import type { LLMProvider } from "@operaia/ai-core";
import type { LLMSelector } from "../ports/llm-selector.js";

/** Seleciona sempre o mesmo provider. Base para estrategias mais ricas. */
export class SingleProviderSelector implements LLMSelector {
  constructor(private readonly provider: LLMProvider) {}

  select(): LLMProvider {
    return this.provider;
  }
}
