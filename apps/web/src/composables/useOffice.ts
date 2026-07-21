import { readonly, ref } from "vue";
import { officeService } from "@/data/office-container";
import type {
  Activity,
  Employee,
  OfficeSummary,
  Project,
  Task,
  Workflow,
} from "@/types/office";

const employees = ref<readonly Employee[]>([]);
const projects = ref<readonly Project[]>([]);
const tasks = ref<readonly Task[]>([]);
const activities = ref<readonly Activity[]>([]);
const summary = ref<OfficeSummary | null>(null);
const loaded = ref(false);
const loading = ref(false);

/**
 * Estado compartilhado do escritorio. Carrega tudo via OfficeService uma unica
 * vez e expoe coleccoes reativas (somente leitura) para as telas.
 */
export function useOffice() {
  async function load(force = false): Promise<void> {
    if ((loaded.value && !force) || loading.value) {
      return;
    }
    loading.value = true;
    const [emp, proj, tsk, act, sum] = await Promise.all([
      officeService.getEmployees(),
      officeService.getProjects(),
      officeService.getTasks(),
      officeService.getActivities(),
      officeService.getSummary(),
    ]);
    employees.value = emp;
    projects.value = proj;
    tasks.value = tsk;
    activities.value = act;
    summary.value = sum;
    loaded.value = true;
    loading.value = false;
  }

  function employeeById(id: string): Employee | undefined {
    return employees.value.find((employee) => employee.id === id);
  }

  function fetchWorkflow(workspaceId: string): Promise<Workflow | undefined> {
    return officeService.getWorkflow(workspaceId);
  }

  return {
    fetchWorkflow,
    employees: readonly(employees),
    projects: readonly(projects),
    tasks: readonly(tasks),
    activities: readonly(activities),
    summary: readonly(summary),
    loading: readonly(loading),
    loaded: readonly(loaded),
    load,
    employeeById,
  };
}
