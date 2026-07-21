import type { OfficeEmployee, OfficeStateId } from "../types";

export type AvatarPose = "idle" | "walk" | "think" | "type" | "present" | "sleep";

export interface AnimationDescriptor {
  /** Pose usada pela CSS do avatar. */
  pose: AvatarPose;
  /** Monitor da estação ligado (tela acesa). */
  monitorOn: boolean;
  /** Balão de pensamento visível. */
  thoughtBubble: boolean;
}

const BY_STATE: Record<OfficeStateId, AnimationDescriptor> = {
  AVAILABLE: { pose: "idle", monitorOn: false, thoughtBubble: false },
  THINKING: { pose: "think", monitorOn: true, thoughtBubble: true },
  ANALYZING: { pose: "type", monitorOn: true, thoughtBubble: true },
  PLANNING: { pose: "type", monitorOn: true, thoughtBubble: false },
  DEVELOPING: { pose: "type", monitorOn: true, thoughtBubble: false },
  AUTOMATING: { pose: "type", monitorOn: true, thoughtBubble: false },
  MEETING: { pose: "present", monitorOn: false, thoughtBubble: false },
  WAITING: { pose: "idle", monitorOn: false, thoughtBubble: true },
  BLOCKED: { pose: "idle", monitorOn: false, thoughtBubble: true },
  OFFLINE: { pose: "sleep", monitorOn: false, thoughtBubble: false },
};

/**
 * Traduz o ESTADO (dado) em ANIMAÇÃO (render), sem conhecer DOM/canvas nem
 * movimentação. Se o funcionário está andando, a caminhada tem prioridade.
 */
export function describeAnimation(employee: OfficeEmployee): AnimationDescriptor {
  if (employee.moving) {
    return { pose: "walk", monitorOn: false, thoughtBubble: false };
  }
  return BY_STATE[employee.state];
}

/** Só o monitor da estação (usado no canvas, que não conhece o avatar). */
export function isMonitorOn(state: OfficeStateId, moving: boolean): boolean {
  return !moving && BY_STATE[state].monitorOn;
}
