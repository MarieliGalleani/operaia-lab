import { ref, watch } from "vue";

const STORAGE_KEY = "operaia.office.theme";

export type OfficeTheme = "dark" | "light";

function readStored(): OfficeTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

const theme = ref<OfficeTheme>(readStored());

watch(theme, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // localStorage indisponivel (modo privado) — tema so nao persiste.
  }
});

/**
 * Tema claro/escuro escopado ao Escritorio Operacional (P1.19) — NAO
 * toca em src/styles/main.css nem no :root global. As variaveis vivem
 * em .operational-office[data-theme] (ver operational-office-theme.css)
 * para nao sobrescrever a identidade azul-violeta ja publicada no resto
 * do app (commit c966924).
 */
export function useOfficeTheme() {
  function toggle(): void {
    theme.value = theme.value === "dark" ? "light" : "dark";
  }
  function set(value: OfficeTheme): void {
    theme.value = value;
  }
  return { theme, toggle, set };
}
