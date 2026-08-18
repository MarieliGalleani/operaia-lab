import { onUnmounted, readonly, ref } from "vue";
import { createMissionsClient } from "@/data/adapters/missions-client";
import {
  isActiveMissionStatus,
  type MissionDetailDTO,
} from "@/data/mission-contracts";

const client = createMissionsClient();
const POLL_MS = 2500;

/**
 * Detalhe persistido (GET /missions/:id) com polling só enquanto a missão está ativa.
 */
export function useMissionDetail() {
  const mission = ref<MissionDetailDTO | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;
  let currentId: string | null = null;

  function stopPolling(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  async function fetchOnce(id: string): Promise<void> {
    try {
      mission.value = await client.getById(id);
      error.value = null;
    } catch (cause) {
      console.log("[missions] falha ao carregar detalhe", id, cause);
      error.value =
        cause instanceof Error ? cause.message : "Não foi possível carregar a missão.";
    }
  }

  function startPolling(id: string): void {
    stopPolling();
    timer = setInterval(() => {
      const status = mission.value?.status;
      if (!status || !isActiveMissionStatus(status)) {
        stopPolling();
        return;
      }
      void fetchOnce(id);
    }, POLL_MS);
  }

  function resetView(): void {
    mission.value = null;
  }

  async function load(id: string): Promise<void> {
    currentId = id;
    loading.value = true;
    error.value = null;
    resetView();
    stopPolling();
    await fetchOnce(id);
    loading.value = false;
    const loaded = mission.value;
    if (loaded && isActiveMissionStatus(loaded.status)) {
      startPolling(id);
    }
  }

  onUnmounted(() => {
    stopPolling();
    currentId = null;
  });

  return {
    mission: readonly(mission),
    loading: readonly(loading),
    error: readonly(error),
    load,
    reload: () => (currentId ? fetchOnce(currentId) : Promise.resolve()),
    stopPolling,
  };
}
