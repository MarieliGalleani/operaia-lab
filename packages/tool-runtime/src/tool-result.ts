import type { ToolError } from "./result.js";

/**
 * Resultado padronizado de qualquer ferramenta.
 */
export type ToolResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ToolError };

export function toolOk<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

export function toolFail<T = never>(error: ToolError): ToolResult<T> {
  return { ok: false, error };
}
