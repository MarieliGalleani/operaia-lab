import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/data/adapters/http-client";
import {
  createAuthSession,
  type AuthSession,
} from "@/modules/auth/auth-session";
import type {
  AdminIdentity,
  AuthApi,
} from "@/modules/auth/auth-api";

const admin: AdminIdentity = {
  id: "9ef41af2-0e39-489b-b0c9-0952a9419f39",
  login: "admin@operaia.com.br",
  role: "ADMIN",
};

const sessions: AuthSession[] = [];

afterEach(() => {
  sessions.splice(0);
  vi.restoreAllMocks();
});

function buildSession(overrides: Partial<AuthApi> = {}) {
  const api: AuthApi = {
    login: vi.fn(async () => undefined),
    me: vi.fn(async () => admin),
    logout: vi.fn(async () => undefined),
    ...overrides,
  };
  const session = createAuthSession(api);
  sessions.push(session);
  return { api, session };
}

describe("estado de autenticacao frontend", () => {
  it("faz login e confirma a identidade com /me", async () => {
    const order: string[] = [];
    const { session } = buildSession({
      login: vi.fn(async () => {
        order.push("login");
      }),
      me: vi.fn(async () => {
        order.push("me");
        return admin;
      }),
    });
    expect(
      await session.login({
        login: admin.login,
        password: "test-only-password",
      }),
    ).toBe(true);
    expect(order).toEqual(["login", "me"]);
    expect(session.user.value).toEqual(admin);
    expect(session.isAuthenticated.value).toBe(true);
  });

  it("trata login invalido sem manter identidade", async () => {
    const { session } = buildSession({
      login: vi.fn(async () => {
        throw new HttpError(401, "/api/auth/login");
      }),
    });
    expect(
      await session.login({
        login: admin.login,
        password: "invalid-password",
      }),
    ).toBe(false);
    expect(session.user.value).toBeNull();
    expect(session.status.value).toBe("anonymous");
    expect(session.message.value).toBe("Login ou senha inválidos.");
  });

  it("restaura sessao persistente apos reload usando /me", async () => {
    const me = vi.fn(async () => admin);
    const { session } = buildSession({ me });
    await session.ensureInitialized();
    await session.ensureInitialized();
    expect(me).toHaveBeenCalledTimes(1);
    expect(session.user.value).toEqual(admin);
  });

  it("considera /me sem sessao como usuario anonimo", async () => {
    const { session } = buildSession({
      me: vi.fn(async () => {
        throw new HttpError(401, "/api/auth/me");
      }),
    });
    await session.ensureInitialized();
    expect(session.status.value).toBe("anonymous");
    expect(session.message.value).toBeNull();
  });

  it("logout remoto sempre limpa o estado local", async () => {
    const logout = vi.fn(async () => undefined);
    const { session } = buildSession({ logout });
    await session.ensureInitialized();
    await session.logout();
    expect(logout).toHaveBeenCalledOnce();
    expect(session.user.value).toBeNull();
    expect(session.status.value).toBe("anonymous");
  });

  it("sessao expirada limpa a identidade e mostra mensagem", async () => {
    const { session } = buildSession();
    await session.ensureInitialized();
    expect(session.expire()).toBe(true);
    expect(session.expire()).toBe(false);
    expect(session.user.value).toBeNull();
    expect(session.message.value).toContain("sessão expirou");
  });

  it("nunca persiste identidade, senha ou token em localStorage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { session } = buildSession();
    await session.login({
      login: admin.login,
      password: "test-only-password",
    });
    await session.logout();
    expect(setItem).not.toHaveBeenCalled();
  });
});
