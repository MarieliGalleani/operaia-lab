/**
 * ActionPolicy — Employee + Action + Workspace = Allowed / Denied.
 * Sem permissao hardcoded nos Employees.
 */
import { ActionId, isKnownActionId, type ActionId as ActionIdType } from "./action-id.js";

export const ActionCapabilityGroup = {
  Docker: "Docker",
  DockerLogs: "DockerLogs",
  DockerRestart: "DockerRestart",
  SystemdStatus: "SystemdStatus",
  Caddy: "Caddy",
} as const;

export type ActionCapabilityGroup =
  (typeof ActionCapabilityGroup)[keyof typeof ActionCapabilityGroup];

export const ACTION_GROUP_ACTIONS: Readonly<
  Record<ActionCapabilityGroup, readonly ActionIdType[]>
> = {
  Docker: [
    ActionId.dockerStatus,
    ActionId.dockerLogs,
    ActionId.dockerRestart,
  ],
  DockerLogs: [ActionId.dockerLogs],
  DockerRestart: [ActionId.dockerRestart],
  SystemdStatus: [ActionId.systemdStatus],
  Caddy: [ActionId.caddyValidate],
};

/**
 * Matriz inicial Sprint A.4:
 * Atlas: docker.* + caddy.* + systemd.status
 * Orion: docker.logs + systemd.status
 * Mag / Luna / Mercurio / Themis: sem execucao
 */
export const DEFAULT_EMPLOYEE_ACTION_GROUPS: Readonly<
  Record<string, readonly ActionCapabilityGroup[]>
> = {
  atlas: [
    ActionCapabilityGroup.Docker,
    ActionCapabilityGroup.Caddy,
    ActionCapabilityGroup.SystemdStatus,
  ],
  orion: [
    ActionCapabilityGroup.DockerLogs,
    ActionCapabilityGroup.SystemdStatus,
  ],
  "cto-mag": [],
  luna: [],
  mercurio: [],
  themis: [],
  aurora: [],
  nexus: [],
  "operaia-ceo": [],
};

export interface ActionPolicyDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

export interface ActionPolicyOptions {
  readonly employeeGroups?: Readonly<
    Record<string, readonly ActionCapabilityGroup[]>
  >;
  readonly groupActions?: Readonly<
    Record<ActionCapabilityGroup, readonly ActionIdType[]>
  >;
}

export class ActionPolicy {
  private readonly employeeGroups: Readonly<
    Record<string, readonly ActionCapabilityGroup[]>
  >;
  private readonly groupActions: Readonly<
    Record<ActionCapabilityGroup, readonly ActionIdType[]>
  >;

  constructor(options: ActionPolicyOptions = {}) {
    this.employeeGroups =
      options.employeeGroups ?? DEFAULT_EMPLOYEE_ACTION_GROUPS;
    this.groupActions = options.groupActions ?? ACTION_GROUP_ACTIONS;
  }

  groupsFor(employeeId: string): readonly ActionCapabilityGroup[] {
    return this.employeeGroups[employeeId] ?? [];
  }

  allowedActions(employeeId: string): readonly ActionIdType[] {
    const groups = this.groupsFor(employeeId);
    const set = new Set<ActionIdType>();
    for (const group of groups) {
      for (const actionId of this.groupActions[group] ?? []) {
        set.add(actionId);
      }
    }
    return [...set];
  }

  isAllowed(employeeId: string, actionId: string): boolean {
    if (!isKnownActionId(actionId)) {
      return false;
    }
    return this.allowedActions(employeeId).includes(actionId);
  }

  /**
   * Avalia Employee + Action (+ Workspace opcional para extensao futura).
   */
  decide(input: {
    readonly employeeId: string;
    readonly actionId: string;
    readonly workspaceId: string;
  }): ActionPolicyDecision {
    if (!input.workspaceId.trim()) {
      return { allowed: false, reason: "workspaceId obrigatorio" };
    }
    if (!isKnownActionId(input.actionId)) {
      return {
        allowed: false,
        reason: `Acao desconhecida: ${input.actionId}`,
      };
    }
    if (!this.isAllowed(input.employeeId, input.actionId)) {
      return {
        allowed: false,
        reason: `Employee ${input.employeeId} sem permissao para ${input.actionId}`,
      };
    }
    return {
      allowed: true,
      reason: `Permitido: ${input.employeeId} → ${input.actionId} @ ${input.workspaceId}`,
    };
  }
}

export const defaultActionPolicy = new ActionPolicy();
