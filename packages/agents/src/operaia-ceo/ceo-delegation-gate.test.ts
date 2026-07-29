import { Specialization } from "@operaia/employee-framework";
import { describe, expect, it } from "vitest";
import { needsSpecialistDelegation } from "./ceo-delegation-gate.js";

describe("CEO delegation gate", () => {
  const pending = ["Implementar autenticacao", "Sincronizar dados offline"];

  it("delega missao de implementacao (aceite operacional)", () => {
    expect(
      needsSpecialistDelegation({
        objective: "Quero implementar autenticação.",
        pendingTitles: pending,
        planRequestsDelegate: true,
      }),
    ).toBe(true);
  });

  it("delega objetivo tecnico NEXO com pendencias", () => {
    expect(
      needsSpecialistDelegation({
        objective: "Quero adicionar autenticação ao NEXO.",
        pendingTitles: pending,
        planRequestsDelegate: true,
      }),
    ).toBe(true);
  });

  it("delega revisao de projeto com pedido de plano tecnico", () => {
    expect(
      needsSpecialistDelegation({
        objective: "Revisar o projeto NEXO e gerar um plano tecnico.",
        pendingTitles: pending,
        planRequestsDelegate: true,
      }),
    ).toBe(true);
  });

  it("CEO responde sozinha em pergunta consultiva", () => {
    expect(
      needsSpecialistDelegation({
        objective: "Como estão meus projetos?",
        pendingTitles: pending,
        planRequestsDelegate: true,
      }),
    ).toBe(false);
  });

  it("nao delega sem pendencias", () => {
    expect(
      needsSpecialistDelegation({
        objective: "Quero implementar autenticação.",
        pendingTitles: [],
        planRequestsDelegate: true,
      }),
    ).toBe(false);
  });

  it("nao delega se o plano nao pediu DELEGATE", () => {
    expect(
      needsSpecialistDelegation({
        objective: "Quero implementar autenticação.",
        pendingTitles: pending,
        planRequestsDelegate: false,
      }),
    ).toBe(false);
  });

  it("delega pedido de avanço operacional", () => {
    expect(
      needsSpecialistDelegation({
        objective: "Avance a missao da NEXO",
        pendingTitles: pending,
        planRequestsDelegate: true,
      }),
    ).toBe(true);
  });

  it("delega ordem de trabalhar nas pendencias sem repetir o titulo tecnico", () => {
    expect(
      needsSpecialistDelegation({
        objective: "trabalha em cima dessas duas pendencias",
        pendingTitles: pending,
        planRequestsDelegate: true,
      }),
    ).toBe(true);
  });

  it("delega 'trabalhar nas tarefas' com pendencias no quadro", () => {
    expect(
      needsSpecialistDelegation({
        objective: "Trabalhar nas tarefas abertas da NEXO",
        pendingTitles: pending,
        planRequestsDelegate: true,
      }),
    ).toBe(true);
  });

  it("delega pedido para executar as proximas acoes", () => {
    expect(
      needsSpecialistDelegation({
        objective: "Faz as próximas ações",
        pendingTitles: pending,
        planRequestsDelegate: true,
      }),
    ).toBe(true);
  });

  it("pergunta sobre papel da equipe permanece consultiva", () => {
    expect(
      needsSpecialistDelegation({
        objective: "quais o papel de voces hoje na empresa?",
        pendingTitles: pending,
        planRequestsDelegate: true,
      }),
    ).toBe(false);
  });
});

describe("CEO delegation gate — specialization still via Matcher", () => {
  it("gate nao escolhe employee por nome (so indica necessidade)", () => {
    const needs = needsSpecialistDelegation({
      objective: "Quero implementar autenticação.",
      pendingTitles: ["Implementar autenticacao"],
      planRequestsDelegate: true,
    });
    expect(needs).toBe(true);
    expect(Specialization.SOFTWARE_ENGINEERING).toBe("SOFTWARE_ENGINEERING");
  });
});
