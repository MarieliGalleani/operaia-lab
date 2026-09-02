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
const error = ref<string | null>(null);

/**
 * Estado compartilhado do escritorio. Carrega tudo via OfficeService uma unica
 * vez e expoe coleccoes reativas (somente leitura) para as telas.
 *
 * P1.X-FIX (REG-08): antes, uma falha em Promise.all deixava `loading`
 * travado em true pra sempre (a excecao saia da funcao antes da linha que
 * zera o loading) — qualquer tela que dependesse disso ficava com
 * "Carregando..." eterno, e novas chamadas a load() retornavam de imediato
 * sem tentar de novo, por causa do guard `loading.value` no topo. Agora
 * loading sempre reseta (try/finally), loaded so vira true em sucesso (uma
 * falha permite retry real), e error fica exposto pra UI distinguir "sem
 * dado" de "nao consegui buscar".
 */
export function useOffice() {
  async function load(force = false): Promise<void> {
    if ((loaded.value && !force) || loading.value) {
      return;
    }
    loading.value = true;
    error.value = null;
    try {
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
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Não foi possível carregar o escritório.";
      console.log("[useOffice] falha ao carregar", err);
    } finally {
      loading.value = false;
    }
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
    error: readonly(error),
    load,
    employeeById,
  };
}
