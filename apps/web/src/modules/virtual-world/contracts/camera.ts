/**
 * Contrato de camera.
 *
 * `CameraController`: operacoes de coordenada (logicas na Fase 0; o motor
 * grafico reflete o estado). `CameraDirector`: intencoes de alto nivel (foco em
 * entidade/area/evento) — resolvidas na Fase 1.
 */

import type { EntityId, WorldRect } from "./ids";

export type Easing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export interface CameraAnimationOptions {
  durationMs?: number;
  easing?: Easing;
}

export interface CameraState {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface CameraController {
  getState(): CameraState;
  moveTo(x: number, y: number, options?: CameraAnimationOptions): void;
  panBy(dx: number, dy: number): void;
  zoomTo(zoom: number, options?: CameraAnimationOptions): void;
  focusPoint(x: number, y: number, options?: CameraAnimationOptions): void;
  focusRect(rect: WorldRect, options?: CameraAnimationOptions): void;
  reset(): void;
  setViewport(width: number, height: number): void;
  setBounds(bounds: WorldRect | null): void;
}

export interface CameraDirector {
  focusEntity(id: EntityId, options?: CameraAnimationOptions): void;
  focusArea(areaId: string, options?: CameraAnimationOptions): void;
  focusEvent(eventId: string, options?: CameraAnimationOptions): void;
}
