import { describe, expect, it } from "vitest";
import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import {
  BriefingBuilder,
  Specialization,
  type EmployeeBriefing,
} from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import { createCeo } from "./ceo-employee.js";
import { DelegationEngine } from "./delegation-engine.js";

class StubLLM implements LLMProvider {
  readonly name = "stub";
  constructor(private readonly content = "Resumo executivo do CEO.") {}
  async complete(_messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    return { content: this.content, model: "stub" };
  }
}

function briefing(
  objective: string,
  tasks: EmployeeBriefing["tasks"] = [],
): EmployeeBriefing {
  return new BriefingBuilder().build(
    {
      workspaceId: "nexo",
      name: "nexo",
      objective,
      tasks: [...tasks],
    },
    objective,
  );
}

describe("Opera + DelegationEngine", () => {
  it("SIGNAL com src gera delegacao Mag (delegationCount > 0)", async () => {
    const llm = new StubLLM("Vou delegar a analise tecnica.");
    const ceo = createCeo(llm);
    const output = await ceo.work({
      briefing: briefing(
        "[COORDINATE/SIGNAL] github.repo.snapshot.changed · workspace=nexo · " +
          "repository=acme/nexo · mudanca=lastCommitSha · " +
          "arquivos=apps/api/src/runtime/foo.ts · motivo=technical_file_change · " +
          "source=sha · correlation=c · delivery=d",
      ),
    });

    expect(output.decision.delegations.length).toBeGreaterThan(0);
    expect(output.decision.delegations[0]?.specialization).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );
  });

  it("Frontend no objective → Luna + Mag", async () => {
    const llm = new StubLLM("Delegando UI e engenharia.");
    const ceo = createCeo(llm);
    const output = await ceo.work({
      briefing: briefing(
        "[COORDINATE/SIGNAL] github.repo.snapshot.changed · workspace=flowgrid · " +
          "repository=acme/web · mudanca=lastCommitSha · " +
          "arquivos=apps/web/src/App.vue, apps/web/src/main.css · " +
          "motivo=technical_file_change · source=sha",
      ),
    });

    const specs = output.decision.delegations.map((d) => d.specialization);
    expect(specs).toEqual(
      expect.arrayContaining([
        Specialization.PRODUCT_DESIGN,
        Specialization.SOFTWARE_ENGINEERING,
      ]),
    );
  });

  it("consolida ExecutionReports — so Opera responde ao usuario", async () => {
    const llm = new StubLLM(
      "Consolidei os pareceres da equipe em uma resposta executiva unica.",
    );
    const ceo = createCeo(llm);
    const output = await ceo.work({
      briefing: {
        ...briefing("Consolidar mudancas do repositorio", [
          {
            id: "t1",
            title: "Revisar API",
            status: TaskStatus.TODO,
            impact: 5,
            urgency: 5,
          },
        ]),
        additional: {
          roadmap: [],
          sessions: [],
          delegationOutcomes: [
            {
              matched: true,
              specialization: Specialization.SOFTWARE_ENGINEERING,
              reason: "backend",
              employeeId: "cto-mag",
              report: {
                summary: "Relatorio bruto da Mag — nao deve ir ao usuario.",
                analysis: "Diff tecnico ok.",
                plan: ["1. Merge"],
                recommendations: ["Rodar testes"],
                risks: ["Regressao"],
                nextActions: ["Abrir PR"],
              },
              executionReport: {
                employeeId: "cto-mag",
                summary: "API estavel",
                findings: ["Diff em apps/api"],
                risks: ["Regressao"],
                recommendations: ["Rodar testes"],
                confidence: 0.9,
                executionTime: 120,
              },
              qualityPassed: true,
            },
            {
              matched: true,
              specialization: Specialization.PRODUCT_DESIGN,
              reason: "frontend",
              employeeId: "luna",
              executionReport: {
                employeeId: "luna",
                summary: "UI consistente",
                findings: ["Vue atualizado"],
                risks: [],
                recommendations: ["QA visual"],
                confidence: 0.8,
                executionTime: 90,
              },
              qualityPassed: true,
            },
          ],
        },
      },
    });

    expect(output.decision.delegations).toHaveLength(0);
    expect(output.decision.reasoning).toMatch(/nao responde|porta-voz|Opera/i);
    expect(output.decision.decision).toContain("Consolidei");
    expect(output.decision.decision).not.toContain(
      "Relatorio bruto da Mag — nao deve ir ao usuario.",
    );
  });

  it("engine validado rejeita MANAGEMENT e deduplica", () => {
    const engine = new DelegationEngine();
    const raw = engine.recommend({
      objective: "x",
      affectedFiles: ["apps/api/a.ts", "packages/x/b.ts"],
    });
    const validated = engine.validate(raw);
    expect(
      validated.specializations.every((s) => s !== Specialization.MANAGEMENT),
    ).toBe(true);
    expect(validated.specializations).toEqual([
      Specialization.SOFTWARE_ENGINEERING,
    ]);
  });
});
