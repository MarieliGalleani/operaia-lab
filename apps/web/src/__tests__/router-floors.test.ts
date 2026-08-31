import { createMemoryHistory } from "vue-router";
import { describe, expect, it } from "vitest";
import { createAppRouter } from "@/router";
import type { AuthSession } from "@/modules/auth/auth-session";

function authenticatedSession(): AuthSession {
  return {
    ensureInitialized: async () => {},
    isAuthenticated: { value: true } as AuthSession["isAuthenticated"],
    user: { value: null } as AuthSession["user"],
    busy: { value: false } as AuthSession["busy"],
    message: { value: null } as AuthSession["message"],
    login: async () => true,
    logout: async () => {},
    expire: () => false,
  } as unknown as AuthSession;
}

describe("Floor routing (Fase 1)", () => {
  it.each([
    ["/", "/app/floor/dev/command"],
    ["/app", "/app/floor/dev/command"],
    ["/app/command", "/app/floor/dev/command"],
    ["/app/command/new", "/app/floor/dev/command/new"],
    ["/app/command/approvals", "/app/floor/dev/command/approvals"],
    ["/app/command/approvals/abc", "/app/floor/dev/command/approvals/abc"],
    ["/app/missions", "/app/floor/dev/missions"],
    ["/app/missions/abc", "/app/floor/dev/missions/abc"],
    ["/app/decisions", "/app/floor/dev/decisions"],
    ["/app/executions", "/app/floor/dev/executions"],
    ["/app/workspaces", "/app/floor/dev/workspaces"],
    ["/app/workspaces/abc", "/app/floor/dev/workspaces/abc"],
    ["/app/team", "/app/floor/dev/team"],
    ["/app/automations", "/app/floor/automation/automations"],
    ["/app/automations/abc", "/app/floor/automation/automations/abc"],
    ["/app/system/schedule-rules", "/app/floor/automation/triggers"],
    ["/app/office/equipe", "/app/floor/dev/team"],
    ["/app/office/projetos", "/app/floor/dev/workspaces"],
    ["/app/office/projetos/abc", "/app/floor/dev/workspaces/abc"],
    ["/app/office/missions", "/app/floor/dev/missions"],
    ["/app/office/missions/abc", "/app/floor/dev/missions/abc"],
    ["/app/office/status", "/app/floor/dev/command"],
    ["/app/floor/dev", "/app/floor/dev/command"],
    ["/app/floor/automation", "/app/floor/automation/command"],
  ])("redireciona %s -> %s", async (from, expected) => {
    const router = createAppRouter(
      authenticatedSession(),
      createMemoryHistory(),
    );
    await router.push(from);
    expect(router.currentRoute.value.fullPath).toBe(expected);
  });

  it.each([
    "/app/floor/dev/command",
    "/app/floor/dev/missions",
    "/app/floor/automation/command",
    "/app/floor/automation/automations",
    "/app/floor/automation/triggers",
    "/app/floor/automation/team",
    "/app/system/infra",
    "/app/system/settings",
    "/app/office",
    "/app/office/sala-ceo",
    "/app/campus",
  ])("resolve %s diretamente (sem redirect)", async (path) => {
    const router = createAppRouter(
      authenticatedSession(),
      createMemoryHistory(),
    );
    await router.push(path);
    expect(router.currentRoute.value.fullPath).toBe(path);
    expect(router.currentRoute.value.matched.length).toBeGreaterThan(0);
  });
});
