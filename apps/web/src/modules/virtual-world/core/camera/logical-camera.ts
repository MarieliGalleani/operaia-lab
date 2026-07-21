/**
 * Camera logica.
 *
 * Mantem o ESTADO da camera (centro + zoom) e emite `camera:moved`. Nao desenha:
 * o motor grafico (Fase 1) reflete este estado no viewport e anima.
 */

import type {
  CameraAnimationOptions,
  CameraController,
  CameraState,
} from "../../contracts/camera";
import type { EventBus } from "../../contracts/events";
import type { WorldRect } from "../../contracts/ids";

export interface LogicalCameraOptions {
  readonly zoom?: number;
  readonly minZoom?: number;
  readonly maxZoom?: number;
}

export class LogicalCamera implements CameraController {
  private x = 0;
  private y = 0;
  private zoom: number;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private bounds: WorldRect | null = null;

  constructor(
    private readonly bus: EventBus,
    options: LogicalCameraOptions = {},
  ) {
    this.zoom = options.zoom ?? 1;
    this.minZoom = options.minZoom ?? 0.25;
    this.maxZoom = options.maxZoom ?? 3;
  }

  getState(): CameraState {
    return { x: this.x, y: this.y, zoom: this.zoom };
  }

  moveTo(x: number, y: number, _options?: CameraAnimationOptions): void {
    this.x = x;
    this.y = y;
    this.clampToBounds();
    this.publish();
  }

  panBy(dx: number, dy: number): void {
    this.moveTo(this.x + dx, this.y + dy);
  }

  zoomTo(zoom: number, _options?: CameraAnimationOptions): void {
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, zoom));
    this.publish();
  }

  focusPoint(x: number, y: number, options?: CameraAnimationOptions): void {
    this.moveTo(x, y, options);
  }

  focusRect(rect: WorldRect, options?: CameraAnimationOptions): void {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    if (this.viewportWidth > 0 && this.viewportHeight > 0 && rect.width > 0 && rect.height > 0) {
      const fit = Math.min(this.viewportWidth / rect.width, this.viewportHeight / rect.height);
      this.zoomTo(fit, options);
    }
    this.moveTo(centerX, centerY, options);
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.publish();
  }

  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  setBounds(bounds: WorldRect | null): void {
    this.bounds = bounds;
    this.clampToBounds();
    this.publish();
  }

  private clampToBounds(): void {
    if (!this.bounds) {
      return;
    }
    const b = this.bounds;
    this.x = Math.min(b.x + b.width, Math.max(b.x, this.x));
    this.y = Math.min(b.y + b.height, Math.max(b.y, this.y));
  }

  private publish(): void {
    this.bus.emit("camera:moved", { state: this.getState() });
  }
}
