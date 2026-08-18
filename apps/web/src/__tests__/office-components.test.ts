import { mount } from "@vue/test-utils";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  createMemoryHistory,
  createRouter,
  type Router,
} from "vue-router";
import ActivityStream from "@/components/ActivityStream.vue";
import EmployeeProfileCard from "@/components/EmployeeProfileCard.vue";
import ExecutiveChat from "@/components/ExecutiveChat.vue";
import ProjectCard from "@/components/ProjectCard.vue";
import SidebarNav from "@/components/SidebarNav.vue";
import TaskBoard from "@/components/TaskBoard.vue";
import WorkflowViewer from "@/components/WorkflowViewer.vue";
import WorkspaceView from "@/components/WorkspaceView.vue";
import OfficeShell from "@/modules/interactive-office/components/OfficeShell.vue";
import { useInteractiveOffice } from "@/modules/interactive-office/composables/useInteractiveOffice";
import { useOffice } from "@/composables/useOffice";
import { activities, projects, tasks } from "@/data/projects";
import type { Workflow } from "@/types/office";

function testRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div/>" } }],
  });
}

beforeAll(async () => {
  await useOffice().load();
});

describe("Sala dos funcionários", () => {
  it("EmployeeProfileCard mostra cargo antes do nome, especialidade e projetos", () => {
    const wrapper = mount(EmployeeProfileCard, {
      props: {
        employee: {
          id: "cto-mag",
          name: "Mag",
          role: "CTO",
          emoji: "👩🏻‍💻",
          specialization: "SOFTWARE_ENGINEERING",
          specialtyLabel: "Tecnologia",
          mission: "Garantir arquitetura sólida.",
          status: "AVAILABLE",
          statusLabel: "Disponível",
          lastActivity: "Plano técnico da NEXO",
          active: true,
        },
        involvedProjects: ["NEXO"],
      },
    });
    expect(wrapper.text()).toContain("CTO — Mag");
    expect(wrapper.text()).toContain("Tecnologia");
    expect(wrapper.text()).toContain("NEXO");
    expect(wrapper.text()).toContain("Plano técnico da NEXO");
  });
});

describe("Projetos como salas", () => {
  it("ProjectCard mostra nome, objetivo e progresso", () => {
    const wrapper = mount(ProjectCard, {
      props: { project: projects[0]! },
      global: { plugins: [testRouter()] },
    });
    expect(wrapper.text()).toContain("NEXO");
    expect(wrapper.text()).toContain("65%");
  });

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
    expect(wrapper.findAll(".stream__item")).toHaveLength(activities.length);
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

describe("Interactive Office (escritório vivo)", () => {
  it("OfficeShell renderiza HUD, canvas e avatares dos funcionários", async () => {
    // jsdom não implementa canvas 2D; o render apenas ignora e mostra o HUD.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await useInteractiveOffice().load();
    const wrapper = mount(OfficeShell, {
      global: { plugins: [testRouter()] },
    });
    const text = wrapper.text();
    expect(text).toContain("Escritório OperaIA.lab");
    expect(text).toContain("Ao vivo");
    expect(wrapper.find(".office-map__canvas").exists()).toBe(true);
    // cada funcionário vira um avatar clicável no mapa
    expect(wrapper.findAll(".avatar").length).toBeGreaterThan(0);
    wrapper.unmount();
    vi.restoreAllMocks();
  });
});

describe("Chat executivo e navegação por salas", () => {
  it("ExecutiveChat inicia com o CEO — Opera", () => {
    const wrapper = mount(ExecutiveChat);
    expect(wrapper.text()).toContain("CEO — Opera");
    expect(wrapper.text()).toContain("Opera");
  });

  it("SidebarNav exibe Campus e áreas do escritório", () => {
    const wrapper = mount(SidebarNav, {
      global: { plugins: [testRouter()] },
    });
    const text = wrapper.text();
    for (const label of [
      "Campus",
      "OperaIA.lab",
      "Sala da CEO",
      "Equipe",
      "Projetos",
      "Missões",
      "Central de atividades",
      "Conhecimento",
      "Painel VPS",
      "Configurações",
    ]) {
      expect(text).toContain(label);
    }
  });
});
