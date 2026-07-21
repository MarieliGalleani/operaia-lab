import type { Employee } from "@operaia/employee-framework";
import { WorkspaceBriefingAdapter } from "../briefing/workspace-briefing-adapter.js";
import type { EmployeeContext } from "./employee-context.js";
import type { EmployeeResult } from "./employee-result.js";

/**
 * Coloca um funcionario para trabalhar dentro de um Workspace.
 *
 * Fluxo: Workspace (snapshot) -> EmployeeBriefing -> Employee -> EmployeeOutput.
 * O funcionario continua recebendo apenas Briefing; toda a adaptacao ocorre
 * aqui, fora dele.
 */
export class EmployeeRunner {
  constructor(
    private readonly briefingAdapter: WorkspaceBriefingAdapter = new WorkspaceBriefingAdapter(),
  ) {}

  async run(employee: Employee, context: EmployeeContext): Promise<EmployeeResult> {
    const briefing = this.briefingAdapter.toBriefing(
      context.workspace,
      context.objective,
    );
    const output = await employee.work({ briefing });

    return {
      employeeId: employee.profile.id,
      profile: employee.profile,
      briefing,
      output,
    };
  }
}
