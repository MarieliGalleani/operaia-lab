import { readonly, ref } from "vue";
import { createMissionsClient } from "@/data/adapters/missions-client";
import type { MissionTreeNodeDTO } from "@/data/mission-contracts";

const client = createMissionsClient();

/**
 * Lista persistida de missões-raiz (COORDINATE) via GET /missions?format=tree.
 */
export function useMissionList() {
  const missions = ref<readonly MissionTreeNodeDTO[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      missions.value = await client.listTree(50);
    } catch (cause) {
      console.log("[missions] falha ao listar", cause);
      error.value =
        cause instanceof Error ? cause.message : "Não foi possível carregar as missões.";
    } finally {
      loading.value = false;
    }
  }

  return {
    missions: readonly(missions),
    loading: readonly(loading),
    error: readonly(error),
    refresh,
  };
}
