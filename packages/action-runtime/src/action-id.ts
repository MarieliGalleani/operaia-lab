/**
 * Identificadores estaveis de acoes controladas (Sprint A.4).
 * Sem shell / exec / run / build / rm arbitrarios.
 */
export const ActionId = {
  dockerStatus: "docker.status",
  dockerLogs: "docker.logs",
  dockerRestart: "docker.restart",
  systemdStatus: "systemd.status",
  caddyValidate: "caddy.validate",
} as const;

export type ActionId = (typeof ActionId)[keyof typeof ActionId];

export const ALL_ACTION_IDS: readonly ActionId[] = Object.values(ActionId);

export function isKnownActionId(value: string): value is ActionId {
  return (ALL_ACTION_IDS as readonly string[]).includes(value);
}
