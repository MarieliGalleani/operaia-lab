import { describe, expect, it } from "vitest";
import { buildCeoAnswer, renderCeoAnswer } from "@/data/ceo-responder";
import { MockOfficeService } from "@/data/mock-office-service";
import { projects, tasks } from "@/data/projects";

const service = new MockOfficeService();

describe("MockOfficeService — carregamento do escritório", () => {
  it("carrega os funcionários incluindo CEO — Opera e CTO — Mag", async () => {
    const employees = await service.getEmployees();
    const ids = employees.map((e) => e.id);
    expect(ids).toContain("operaia-ceo");
    expect(ids).toContain("cto-mag");
    // vagas preparadas para novas contratações
    expect(ids).toContain("ux-luna");
    expect(employees.some((e) => !e.active)).toBe(true);
  });

  it("expõe os projetos (workspaces) NEXO, MenuFlow e Plataforma", async () => {
    const list = await service.getProjects();
    expect(list.map((p) => p.name)).toEqual(["NEXO", "MenuFlow", "Plataforma"]);
  });

  it("abre um workspace específico pelo id", async () => {
    const nexo = await service.getProject("nexo");
    expect(nexo?.name).toBe("NEXO");
    expect(nexo?.teamIds).toContain("cto-mag");
  });

  it("expõe o fluxo de delegação (CEO → CTO → resultado) da NEXO", async () => {
    const workflow = await service.getWorkflow("nexo");
    expect(workflow?.workspaceId).toBe("nexo");
    const stages = workflow?.steps.map((step) => step.stage) ?? [];
    expect(stages).toEqual([
      "THINKING",
      "ANALYZING",
      "DELEGATING",
      "EXECUTING",
      "REVIEWING",
      "DONE",
    ]);
    // a etapa em execução pertence ao especialista (CTO — Mag)
    const current = workflow?.steps.find((step) => step.status === "current");
    expect(current?.actorId).toBe("cto-mag");
  });

  it("retorna indefinido para workspace sem fluxo", async () => {
    expect(await service.getWorkflow("inexistente")).toBeUndefined();
  });

  it("resume o escritório com contadores coerentes", async () => {
    const summary = await service.getSummary();
    expect(summary.activeProjects).toBe(1);
    expect(summary.workingEmployees).toBeGreaterThanOrEqual(1);
    expect(summary.pendingTasks).toBeGreaterThan(0);
  });
});

describe("Chat executivo com o CEO — Opera", () => {
  it("responde no formato executivo (resumo, projetos, riscos, ações)", async () => {
    const reply = await service.askCeo("Opera, como estão meus projetos?");
    expect(reply.author).toBe("ceo");
    expect(reply.answer?.projects.length).toBeGreaterThan(0);
    expect(reply.content).toContain("Resumo executivo");
    expect(reply.content).toContain("Riscos");
    expect(reply.content).toContain("Próximas ações");
  });

  it("buildCeoAnswer resume o estado atual dos projetos", () => {
    const answer = buildCeoAnswer("status?", projects, tasks);
    expect(answer.summary).toContain("projeto");
    expect(answer.projects.some((line) => line.includes("NEXO"))).toBe(true);
    expect(renderCeoAnswer(answer)).toContain("Projetos");
  });
});
