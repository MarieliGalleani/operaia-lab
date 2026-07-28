import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import {
  BriefingBuilder,
  Specialization,
  type EmployeeBriefing,
} from "@operaia/employee-framework";
import { Priority, TaskStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import { CeoPlanAction } from "./ceo-types.js";
import { CeoPlanner } from "./ceo-planner.js";
import { CeoPrioritizer } from "./ceo-prioritizer.js";
import { CeoReviewer } from "./ceo-reviewer.js";
import { ceoProfile } from "./ceo-profile.js";
import { createCeo } from "./ceo-employee.js";

class StubLLM implements LLMProvider {
  readonly name = "stub";
  public lastMessages: readonly LLMMessage[] = [];
  constructor(private readonly content = "Resumo executivo do CEO.") {}
  async complete(messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    this.lastMessages = messages;
    return { content: this.content, model: "stub" };
  }
}

function briefing(
  tasks: EmployeeBriefing["tasks"],
  objective = "Finalizar a NEXO",
): EmployeeBriefing {
  return new BriefingBuilder().build(
    { workspaceId: "nexo", name: "NEXO", tasks },
    objective,
  );
}

// --- Planner ---------------------------------------------------------------

describe("CeoPlanner", () => {
  it("decompoe um objetivo com pendencias", () => {
    const plan = new CeoPlanner().plan(
      briefing([{ id: "t1", title: "Login", status: TaskStatus.TODO }]),
    );
    expect(plan.steps.map((step) => step.action)).toEqual([
      CeoPlanAction.ANALYZE_WORKSPACE,
      CeoPlanAction.REVIEW_PENDING,
      CeoPlanAction.UPDATE_ROADMAP,
      CeoPlanAction.DELEGATE,
      CeoPlanAction.REPORT,
    ]);
  });

  it("inclui CREATE_TASKS quando nao ha pendencias", () => {
    const plan = new CeoPlanner().plan(briefing([]));
    const actions = plan.steps.map((step) => step.action);
    expect(actions).toContain(CeoPlanAction.CREATE_TASKS);
    expect(actions).not.toContain(CeoPlanAction.DELEGATE);
  });
});

// --- Prioritizer -----------------------------------------------------------

describe("CeoPrioritizer", () => {
  it("ordena por score e ignora concluidas", () => {
    const result = new CeoPrioritizer().prioritize([
      { id: "a", title: "Alta", status: TaskStatus.TODO, impact: 5, urgency: 5, risk: 4, effort: 1 },
      { id: "b", title: "Baixa", status: TaskStatus.TODO, impact: 1, urgency: 1, risk: 1, effort: 5 },
      { id: "c", title: "Feita", status: TaskStatus.DONE },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]?.taskId).toBe("a");
    expect(result[0]?.priority).toBe(Priority.URGENT);
    expect(result[1]?.priority).toBe(Priority.LOW);
  });

  it("eleva quem desbloqueia outras tarefas", () => {
    const result = new CeoPrioritizer().prioritize([
      { id: "base", title: "Base", status: TaskStatus.TODO, impact: 2, urgency: 2, risk: 2, effort: 2 },
      { id: "x", title: "X", status: TaskStatus.TODO, impact: 2, urgency: 2, risk: 2, effort: 2, dependsOn: ["base"] },
      { id: "y", title: "Y", status: TaskStatus.TODO, impact: 2, urgency: 2, risk: 2, effort: 2, dependsOn: ["base"] },
    ]);
    expect(result[0]?.taskId).toBe("base");
  });
});

// --- Reviewer --------------------------------------------------------------

describe("CeoReviewer", () => {
  it("reconhece objetivo concluido", () => {
    const review = new CeoReviewer().review(
      briefing([{ id: "t1", title: "T1", status: TaskStatus.DONE }]),
    );
    expect(review.objectiveAchieved).toBe(true);
    expect(review.needsNewCycle).toBe(false);
  });

  it("reconhece objetivo pendente e conta bloqueios", () => {
    const review = new CeoReviewer().review(
      briefing([
        { id: "t1", title: "T1", status: TaskStatus.DONE },
        { id: "t2", title: "T2", status: TaskStatus.BLOCKED },
        { id: "t3", title: "T3", status: TaskStatus.TODO },
      ]),
    );
    expect(review.objectiveAchieved).toBe(false);
    expect(review.pendingCount).toBe(2);
    expect(review.blockedCount).toBe(1);
  });
});

// --- Migracao: CEO como funcionario do Framework ---------------------------

describe("OperaIA CEO (migrado para o Employee Framework)", () => {
  it("expoe o perfil no contrato comum com specialization MANAGEMENT", () => {
    expect(ceoProfile.id).toBe("operaia-ceo");
    expect(ceoProfile.specialization).toBe(Specialization.MANAGEMENT);
    expect(ceoProfile.limits).toContain("nao escreve codigo");
  });

  it("trabalha sobre um Briefing e entrega o report padrao (6 secoes)", async () => {
    const llm = new StubLLM("A NEXO avanca, mas restam tarefas.");
    const ceo = createCeo(llm);

    const output = await ceo.work({
      briefing: briefing([
        { id: "t1", title: "Implementar login", status: TaskStatus.TODO, impact: 5, urgency: 5 },
        { id: "t2", title: "Escrever docs", status: TaskStatus.TODO, impact: 2, urgency: 1 },
      ]),
    });

    expect(output.report.summary).toBe("A NEXO avanca, mas restam tarefas.");
    expect(output.report.nextActions[0]).toContain("Implementar login");
    expect(output.report.plan.length).toBeGreaterThan(0);
    expect(output.quality.passed).toBe(true);
    // delega implementacao para engenharia (fora da propria especialidade)
    expect(output.decision.delegations[0]?.specialization).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );
    // usa o LLMProvider injetado com o system prompt em blocos
    expect(llm.lastMessages[0]?.content).toContain("OperaIA CEO");
  });

  it("objetivo de lancamento gera multiplas delegacoes nativas", async () => {
    const llm = new StubLLM("Plano de lancamento multi-dominio pronto.");
    const ceo = createCeo(llm);
    const output = await ceo.work({
      briefing: briefing(
        [
          {
            id: "t1",
            title: "Implementar autenticacao",
            status: TaskStatus.TODO,
            impact: 5,
            urgency: 5,
          },
        ],
        "Lancar o NEXO",
      ),
    });
    expect(output.decision.delegations.length).toBeGreaterThanOrEqual(4);
    const specs = output.decision.delegations.map((d) => d.specialization);
    expect(specs).toContain(Specialization.SOFTWARE_ENGINEERING);
    expect(specs).toContain(Specialization.PRODUCT_DESIGN);
    expect(specs).toContain(Specialization.MARKETING);
  });

  it("reconhece objetivo concluido sem delegar", async () => {
    const ceo = createCeo(new StubLLM());
    const output = await ceo.work({
      briefing: briefing([{ id: "t1", title: "T1", status: TaskStatus.DONE }]),
    });
    expect(output.decision.delegations).toHaveLength(0);
    expect(output.quality.passed).toBe(true);
  });

  it("consolida entregas de especialistas sem redelegar", async () => {
    const llm = new StubLLM("Consolidei o plano da Mag para o usuario.");
    const ceo = createCeo(llm);

    const output = await ceo.work({
      briefing: {
        ...briefing([
          {
            id: "t1",
            title: "Implementar autenticacao",
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
              reason: "Implementar",
              employeeId: "cto-mag",
              report: {
                summary: "Plano tecnico da Mag.",
                analysis: "Analise tecnica.",
                plan: ["1. Revisar arquitetura"],
                recommendations: ["Quebrar em tarefas"],
                risks: ["Dependencia de auth"],
                nextActions: ["Implementar: autenticacao"],
              },
              qualityPassed: true,
            },
          ],
        },
      },
    });

    expect(output.decision.delegations).toHaveLength(0);
    expect(output.decision.analyzed).toContain("consolidacao");
    expect(output.report.summary).toContain("Consolidei");
    expect(output.report.risks).toContain("Dependencia de auth");
    expect(llm.lastMessages[1]?.content).toContain("consolidacao");
  });
});
