import type { ToolProvider } from "../ports/tool-provider.js";
import type { Tool } from "../types/tool.js";

/** Provider padrao sem ferramentas. Substituivel por um catalogo real. */
export class EmptyToolProvider implements ToolProvider {
  discover(): readonly Tool[] {
    return [];
  }
}
