import { ref, watchEffect } from "vue";

const STORAGE_KEY = "operaia.office.theme";

export type AppTheme = "dark" | "light";

function readStored(): AppTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

const theme = ref<AppTheme>(readStored());

watchEffect(() => {
  document.documentElement.dataset.theme = theme.value;
  try {
    localStorage.setItem(STORAGE_KEY, theme.value);
  } catch {
    // localStorage indisponivel (modo privado) — tema so nao persiste.
  }
});

/**
 * Tema claro/escuro GLOBAL do app (P1.21 — Escritorio Operacional como
 * casca principal). Controla document.documentElement[data-theme], que
 * main.css usa pra trocar os tokens --op-*.
 */
export function useAppTheme() {
  function toggle(): void {
    theme.value = theme.value === "dark" ? "light" : "dark";
  }
  function set(value: AppTheme): void {
    theme.value = value;
  }
  return { theme, toggle, set };
}
