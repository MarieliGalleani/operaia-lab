import { mount } from "@vue/test-utils";
import { beforeAll, describe, expect, it } from "vitest";
import ActivityStream from "@/components/ActivityStream.vue";
import TaskBoard from "@/components/TaskBoard.vue";
import WorkflowViewer from "@/components/WorkflowViewer.vue";
import WorkspaceView from "@/components/WorkspaceView.vue";
import { useOffice } from "@/composables/useOffice";
import { activities, projects, tasks } from "@/data/projects";
import type { Workflow } from "@/types/office";

beforeAll(async () => {
  await useOffice().load();
});

describe("Projetos como salas", () => {
  it("WorkspaceView mostra objetivo, equipe e decisões", () => {
    const wrapper = mount(WorkspaceView, { props: { project: projects[0]! } });
    expect(wrapper.text()).toContain("Finalizar desenvolvimento da NEXO");
    expect(wrapper.text()).toContain("Equipe envolvida");
    expect(wrapper.text()).toContain("Últimas decisões");
  });
});

describe("Tarefas, activity stream e workflow", () => {
  it("TaskBoard renderiza as três colunas executivas", () => {
    const wrapper = mount(TaskBoard, { props: { tasks } });
    expect(wrapper.text()).toContain("Backlog");
    expect(wrapper.text()).toContain("Em andamento");
    expect(wrapper.text()).toContain("Concluído");
  });

  it("ActivityStream lista as atividades com horário", () => {
    const wrapper = mount(ActivityStream, { props: { activities } });
    expect(wrapper.findAll(".op-stream__item")).toHaveLength(activities.length);
  });

  it("WorkflowViewer mostra os estágios e a cadeia de delegação", () => {
    const workflow: Workflow = {
      workspaceId: "nexo",
      title: "Delegação técnica da NEXO",
      steps: [
        { stage: "ANALYZING", actorId: "operaia-ceo", detail: "Análise", status: "done" },
        { stage: "EXECUTING", actorId: "cto-mag", detail: "Plano técnico", status: "current" },
      ],
    };
    const wrapper = mount(WorkflowViewer, { props: { workflow } });
    expect(wrapper.text()).toContain("Pensando");
    expect(wrapper.text()).toContain("Executando");
    expect(wrapper.text()).toContain("CTO — Mag");
    expect(wrapper.text()).toContain("Plano técnico");
  });
});
