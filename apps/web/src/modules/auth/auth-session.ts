import { computed, readonly, ref, type ComputedRef, type Ref } from "vue";
import { HttpError } from "@/data/adapters/http-client";
import {
  createAuthApi,
  type AdminIdentity,
  type AuthApi,
  type LoginCredentials,
} from "./auth-api";

export type AuthStatus =
  | "unknown"
  | "checking"
  | "authenticated"
  | "anonymous";

export interface AuthSession {
  readonly status: Readonly<Ref<AuthStatus>>;
  readonly user: Readonly<Ref<AdminIdentity | null>>;
  readonly message: Readonly<Ref<string | null>>;
  readonly busy: Readonly<Ref<boolean>>;
  readonly isAuthenticated: ComputedRef<boolean>;
  ensureInitialized(): Promise<void>;
  login(credentials: LoginCredentials): Promise<boolean>;
  logout(): Promise<void>;
  expire(): boolean;
  clearMessage(): void;
}

export function createAuthSession(api: AuthApi): AuthSession {
  const status = ref<AuthStatus>("unknown");
  const user = ref<AdminIdentity | null>(null);
  const message = ref<string | null>(null);
  const busy = ref(false);
  let initialization: Promise<void> | null = null;

  async function checkSession(): Promise<void> {
    status.value = "checking";
    try {
      user.value = await api.me();
      status.value = "authenticated";
      message.value = null;
    } catch (error) {
      user.value = null;
      status.value = "anonymous";
      if (!(error instanceof HttpError && error.status === 401)) {
        message.value =
          "Não foi possível verificar sua sessão. Entre novamente.";
      }
    }
  }

  async function ensureInitialized(): Promise<void> {
    if (status.value !== "unknown") {
      return;
    }
    initialization ??= checkSession().finally(() => {
      initialization = null;
    });
    await initialization;
  }

  async function login(credentials: LoginCredentials): Promise<boolean> {
    busy.value = true;
    message.value = null;
    try {
      await api.login(credentials);
      user.value = await api.me();
      status.value = "authenticated";
      return true;
    } catch (error) {
      user.value = null;
      status.value = "anonymous";
      message.value = loginErrorMessage(error);
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function logout(): Promise<void> {
    busy.value = true;
    try {
      await api.logout();
    } catch {
      // A sessão local deve terminar mesmo se já expirou no servidor.
    } finally {
      user.value = null;
      status.value = "anonymous";
      message.value = null;
      busy.value = false;
    }
  }

  function expire(): boolean {
    if (status.value === "anonymous") {
      return false;
    }
    user.value = null;
    status.value = "anonymous";
    message.value = "Sua sessão expirou. Entre novamente para continuar.";
    return true;
  }

  function clearMessage(): void {
    message.value = null;
  }

  return {
    status: readonly(status),
    user: readonly(user),
    message: readonly(message),
    busy: readonly(busy),
    isAuthenticated: computed(() => status.value === "authenticated"),
    ensureInitialized,
    login,
    logout,
    expire,
    clearMessage,
  };
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof HttpError && error.status === 401) {
    return "Login ou senha inválidos.";
  }
  if (error instanceof HttpError && error.status === 429) {
    return "Muitas tentativas. Aguarde um minuto e tente novamente.";
  }
  return "Não foi possível entrar. Tente novamente.";
}

export const authSession = createAuthSession(createAuthApi());
