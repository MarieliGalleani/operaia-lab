import { MockOfficeService } from "@/data/mock-office-service";
import type { OfficeService } from "@/data/office-service";
import type { ChatMessage } from "@/types/office";
import { EmployeeProvider } from "./employee-provider";
import { EventProvider } from "./event-provider";
import type { InteractiveOfficeProvider, OfficeSnapshot } from "./office-provider";
import { WorkspaceProvider } from "./workspace-provider";

/** Provider 100% local (dados mockados) — ideal para desenvolvimento e testes. */
export class MockProvider implements InteractiveOfficeProvider {
  readonly kind = "mock" as const;
  private readonly service: OfficeService = new MockOfficeService();
  private readonly employees = new EmployeeProvider(this.service);
  private readonly workspaces = new WorkspaceProvider(this.service);
  private readonly events = new EventProvider(this.service);

  async load(): Promise<OfficeSnapshot> {
    const [employees, workspaces, events] = await Promise.all([
      this.employees.load(),
      this.workspaces.load(),
      this.events.load(),
    ]);
    return { employees, workspaces, events };
  }

  askExecutive(question: string): Promise<ChatMessage> {
    return this.service.askCeo(question);
  }
}
