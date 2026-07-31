import type { ToolId } from "./tool-id.js";

/**
 * Codigos de erro padronizados do Tool Runtime.
 */
export const ToolErrorCode = {
  PERMISSION_DENIED: "PERMISSION_DENIED",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  INVALID_INPUT: "INVALID_INPUT",
  NOT_FOUND: "NOT_FOUND",
  PATH_FORBIDDEN: "PATH_FORBIDDEN",
  IO_ERROR: "IO_ERROR",
  UNAVAILABLE: "UNAVAILABLE",
  RATE_LIMIT: "RATE_LIMIT",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NETWORK: "NETWORK",
  UNKNOWN: "UNKNOWN",
} as const;

export type ToolErrorCode =
  (typeof ToolErrorCode)[keyof typeof ToolErrorCode];

export interface ToolError {
  readonly code: ToolErrorCode;
  readonly message: string;
  readonly toolId: ToolId;
  readonly employeeId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class ToolRuntimeError extends Error {
  readonly code: ToolErrorCode;
  readonly toolId: ToolId;
  readonly employeeId?: string;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(error: ToolError) {
    super(error.message);
    this.name = "ToolRuntimeError";
    this.code = error.code;
    this.toolId = error.toolId;
    this.employeeId = error.employeeId;
    this.details = error.details;
  }

  toToolError(): ToolError {
    return {
      code: this.code,
      message: this.message,
      toolId: this.toolId,
      employeeId: this.employeeId,
      details: this.details,
    };
  }
}

export function toolError(input: ToolError): ToolError {
  return input;
}
