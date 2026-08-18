import { describe, expect, it } from "vitest";
import type { AuthenticatedAdmin } from "./auth.types.js";
import {
  ADMIN_OFFICIAL_WORKSPACE_IDS,
  hasOfficialWorkspaceAccess,
  requireOfficialWorkspaceAccess,
  WorkspaceAccessDeniedError,
} from "./official-workspace-access.js";

const admin: AuthenticatedAdmin = {
  id: "admin-1",
  login: "admin@operaia.com.br",
  role: "ADMIN",
};

const expectedWorkspaces = [
  "operaia-lab",
  "nexo",
  "infra",
  "deploy",
  "flowgrid",
  "hexalife",
  "odontoclinic",
  "estocai",
] as const;

describe("acesso single-admin aos workspaces oficiais", () => {
  it("reutiliza exatamente os oito workspaces do catalogo oficial", () => {
    expect(ADMIN_OFFICIAL_WORKSPACE_IDS).toEqual(expectedWorkspaces);
    for (const workspaceId of expectedWorkspaces) {
      expect(hasOfficialWorkspaceAccess(admin, workspaceId)).toBe(true);
      expect(requireOfficialWorkspaceAccess(admin, workspaceId)).toBe(
        workspaceId,
      );
    }
  });

  it.each(["menuflow", "plataforma", "desconhecido"])(
    "rejeita workspace fora do catalogo: %s",
    (workspaceId) => {
      expect(hasOfficialWorkspaceAccess(admin, workspaceId)).toBe(false);
      expect(() =>
        requireOfficialWorkspaceAccess(admin, workspaceId),
      ).toThrow(WorkspaceAccessDeniedError);
    },
  );
});
