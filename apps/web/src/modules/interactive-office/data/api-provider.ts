import { officeService } from "@/data/office-container";
import type { OfficeService } from "@/data/office-service";
import type { ChatMessage } from "@/types/office";
import { EmployeeProvider } from "./employee-provider";
import { EventProvider } from "./event-provider";
import type { InteractiveOfficeProvider, OfficeSnapshot } from "./office-provider";
import { WorkspaceProvider } from "./workspace-provider";

/**
 * Provider ligado ao OfficeService do container (respeita VITE_USE_REAL_API).
 * Quando o backend expõe os endpoints, nada nos componentes muda.
 */
export class ApiProvider implements InteractiveOfficeProvider {
  readonly kind = "api" as const;

  constructor(private readonly service: OfficeService = officeService) {}

  async load(): Promise<OfficeSnapshot> {
    const [employees, workspaces, events] = await Promise.all([
      new EmployeeProvider(this.service).load(),
      new WorkspaceProvider(this.service).load(),
      new EventProvider(this.service).load(),
    ]);
    return { employees, workspaces, events };
  }

  askExecutive(question: string): Promise<ChatMessage> {
    return this.service.askCeo(question);
  }
}
