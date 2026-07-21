import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import OfficeLayout from "@/layouts/OfficeLayout.vue";
import OfficeWorldPage from "@/views/OfficeWorldPage.vue";
import ExecutiveRoom from "@/views/ExecutiveRoom.vue";
import ProjectsView from "@/views/ProjectsView.vue";
import WorkspaceRoom from "@/views/WorkspaceRoom.vue";
import EmployeeRoom from "@/views/EmployeeRoom.vue";
import ActivityCenter from "@/views/ActivityCenter.vue";
import KnowledgeView from "@/views/KnowledgeView.vue";
import SettingsView from "@/views/SettingsView.vue";
import VirtualWorldTest from "@/views/VirtualWorldTest.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/office" },
  {
    path: "/office",
    component: OfficeLayout,
    children: [
      { path: "", name: "office", component: OfficeWorldPage },
      { path: "sala-ceo", name: "ceo-room", component: ExecutiveRoom },
      { path: "equipe", name: "team", component: EmployeeRoom },
      { path: "projetos", name: "projects", component: ProjectsView },
      {
        path: "projetos/:id",
        name: "workspace",
        component: WorkspaceRoom,
        props: true,
      },
      { path: "atividades", name: "activities", component: ActivityCenter },
      { path: "conhecimento", name: "knowledge", component: KnowledgeView },
      { path: "configuracoes", name: "settings", component: SettingsView },
    ],
  },
  {
    path: "/virtual-world-test",
    name: "virtual-world-test",
    component: VirtualWorldTest,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
