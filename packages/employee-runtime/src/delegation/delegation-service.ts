import type { DelegationRequest } from "@operaia/employee-framework";
import type { EmployeeContext } from "../activation/employee-context.js";
import type { EmployeeResult } from "../activation/employee-result.js";
import { EmployeeRunner } from "../activation/employee-runner.js";
import { EmployeeMatcher } from "./employee-matcher.js";

/**
 * Resultado de um pedido de delegacao: o pedido original, se houve um
 * especialista compativel e (quando houve) o que ele entregou.
 */
export interface DelegationOutcome {
  readonly request: DelegationRequest;
  readonly matched: boolean;
  readonly employeeId?: string;
  readonly result?: EmployeeResult;
}

/**
 * Orquestra a delegacao: para cada pedido de especialidade, encontra o
 * especialista (Matcher), constroi seu briefing focado e o coloca para
 * trabalhar (Runner), devolvendo o retorno para quem delegou (ex.: o CEO).
 *
 * `dependencies` sao as deps de runtime repassadas ao criar o funcionario
 * (ex.: { llm }); ficam fora do dominio dos funcionarios.
 */
export class DelegationService {
  constructor(
    private readonly matcher: EmployeeMatcher,
    private readonly runner: EmployeeRunner,
    private readonly dependencies?: unknown,
  ) {}

  async run(
    delegations: readonly DelegationRequest[],
    context: EmployeeContext,
  ): Promise<DelegationOutcome[]> {
    const outcomes: DelegationOutcome[] = [];

    for (const request of delegations) {
      const matched = this.matcher.match(request.specialization);
      if (!matched) {
        outcomes.push({ request, matched: false });
        continue;
      }

      const employee = matched.create(this.dependencies);
      const objective = request.task ?? request.reason ?? context.objective;
      const result = await this.runner.run(employee, {
        workspace: context.workspace,
        objective,
        memoryNotes: context.memoryNotes,
      });

      outcomes.push({
        request,
        matched: true,
        employeeId: employee.profile.id,
        result,
      });
    }

    return outcomes;
  }
}
