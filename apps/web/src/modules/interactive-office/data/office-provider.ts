import type { ChatMessage } from "@/types/office";
import type { OfficeEmployee, OfficeEvent, OfficeWorkspace } from "../types";

export interface OfficeSnapshot {
  employees: OfficeEmployee[];
  workspaces: OfficeWorkspace[];
  events: OfficeEvent[];
}

/**
 * Fonte de dados do escritório. Trocar mock por API é apenas trocar o provider
 * (ver provider-factory). Nenhum componente conhece a origem dos dados.
 */
export interface InteractiveOfficeProvider {
  readonly kind: "mock" | "api";
  load(): Promise<OfficeSnapshot>;
  askExecutive(question: string): Promise<ChatMessage>;
}
