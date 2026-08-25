import { onMounted, onUnmounted, readonly, ref } from "vue";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { CommandCenterDto } from "@/data/office-command";

const POLL_MS = 30_000;

export function useCommandCenter() {
  const data = ref<CommandCenterDto | null>(null);
  const state = ref<"loading" | "ready" | "error">("loading");
  const errorMessage = ref("Não foi possível carregar o Command Center.");
  let timer: ReturnType<typeof setInterval> | null = null;

  async function load() {
    try {
      const next = await officeCommandClient.getCommandCenter();
      data.value = next;
      state.value = "ready";
    } catch (error) {
      console.log("[useCommandCenter] load failed", error);
      state.value = data.value ? "ready" : "error";
      errorMessage.value = "Estado do escritório indisponível.";
    }
  }

  onMounted(() => {
    void load();
    timer = setInterval(() => {
      void load();
    }, POLL_MS);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
    timer = null;
  });

  return {
    data: readonly(data),
    state: readonly(state),
    errorMessage: readonly(errorMessage),
    load,
  };
}
