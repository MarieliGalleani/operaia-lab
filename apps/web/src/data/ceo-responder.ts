import type { ExecutiveAnswer, Project, Task } from "@/types/office";

const STATUS_LABEL: Record<Project["status"], string> = {
  ACTIVE: "em andamento",
  PLANNED: "planejado",
  PAUSED: "pausado",
  COMPLETED: "concluído",
};

/**
 * Gera a resposta executiva do CEO — Opera a partir do estado atual.
 *
 * Deterministico e sem IA: no futuro esta funcao sera substituida por uma
 * chamada real ao CEO — Opera via API (Employee Activation Layer).
 */
export function buildCeoAnswer(
  _question: string,
  projects: readonly Project[],
  tasks: readonly Task[],
): ExecutiveAnswer {
  const active = projects.filter((project) => project.status === "ACTIVE");
  const pending = tasks.filter((task) => task.status !== "DONE");
  const urgent = pending.filter(
    (task) => task.priority === "URGENT" || task.priority === "HIGH",
  );

  const summary =
    `Temos ${projects.length} projeto(s) no escritório, ${active.length} em ` +
    `execução ativa e ${pending.length} tarefa(s) em aberto. ` +
    (urgent.length > 0
      ? `Há ${urgent.length} item(ns) de alta prioridade exigindo atenção.`
      : "Nenhum item crítico no momento.");

  const projectLines = projects.map(
    (project) =>
      `${project.name} — ${STATUS_LABEL[project.status]} (${project.progress}%): ${project.objective}.`,
  );

  const risks =
    urgent.length > 0
      ? urgent.map((task) => `Prioridade ${task.priority}: ${task.title}.`)
      : ["Sem riscos relevantes identificados neste ciclo."];

  const nextActions = [
    active.length > 0
      ? `Acompanhar a execução de ${active.map((p) => p.name).join(", ")}.`
      : "Ativar o próximo projeto do backlog.",
    urgent.length > 0
      ? `Priorizar: ${urgent[0]?.title}.`
      : "Revisar o roadmap com a equipe.",
    "Delegar execução técnica à CTO — Mag quando necessário.",
  ];

  return { summary, projects: projectLines, risks, nextActions };
}

/** Renderiza a resposta executiva em texto para exibicao no chat. */
export function renderCeoAnswer(answer: ExecutiveAnswer): string {
  const block = (title: string, lines: readonly string[]): string =>
    `${title}\n${lines.map((line) => `• ${line}`).join("\n")}`;

  return [
    `Resumo executivo\n${answer.summary}`,
    block("Projetos", answer.projects),
    block("Riscos", answer.risks),
    block("Próximas ações", answer.nextActions),
  ].join("\n\n");
}
