/**
 * Enquadramento de câmera — matemática PURA (sem PixiJS, sem negócio).
 *
 * Calcula, a partir dos limites do mundo desenhado e do tamanho da tela:
 *  - centro do mapa (para centralização);
 *  - zoom de "fit" (mapa inteiro visível) e faixa min/max de zoom;
 *  - limites de pan (clamp) para a câmera não sair do mundo.
 *
 * Genérico: serve para qualquer mapa. Reutilizável e testável isoladamente.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

export interface CameraFramingOptions {
  /** Fração da tela ocupada pelo mapa no fit inicial (0-1). */
  readonly fitFactor?: number;
  /** Padding (em px de mundo) somado aos limites de pan. */
  readonly boundsPadding?: number;
  /** Menor zoom permitido = zoomFit * minZoomFactor. */
  readonly minZoomFactor?: number;
  /** Maior zoom permitido (escala absoluta). */
  readonly maxZoom?: number;
  /** Zoom preferido de jogo (mais próximo que o fit do mapa inteiro). */
  readonly playZoom?: number;
}

export interface CameraLimits {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface CameraFraming {
  readonly center: { readonly x: number; readonly y: number };
  readonly zoom: number;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly limits: CameraLimits;
}

const DEFAULTS = {
  /** Fit um pouco mais "fechado" — menos borda vazia no enquadramento. */
  fitFactor: 0.95,
  /** Padding baixo evita pan para espaços vazios além do mapa. */
  boundsPadding: 24,
  minZoomFactor: 0.55,
  maxZoom: 3.5,
  /**
   * Zoom de jogo (play). Após o fit, a câmera sobe para este valor (clampado)
   * para enxergar o escritório de perto, estilo simulação moderna.
   */
  playZoom: 1.35,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function computeCameraFraming(
  world: Rect,
  screen: ScreenSize,
  options: CameraFramingOptions = {},
): CameraFraming {
  const fitFactor = options.fitFactor ?? DEFAULTS.fitFactor;
  const boundsPadding = options.boundsPadding ?? DEFAULTS.boundsPadding;
  const minZoomFactor = options.minZoomFactor ?? DEFAULTS.minZoomFactor;
  const maxZoom = options.maxZoom ?? DEFAULTS.maxZoom;
  const playZoom = options.playZoom ?? DEFAULTS.playZoom;

  const center = {
    x: world.x + world.width / 2,
    y: world.y + world.height / 2,
  };

  const canFit =
    isPositiveFinite(world.width) &&
    isPositiveFinite(world.height) &&
    isPositiveFinite(screen.width) &&
    isPositiveFinite(screen.height);

  const zoomFit = canFit
    ? Math.min(screen.width / world.width, screen.height / world.height) * fitFactor
    : 1;

  const minZoom = Math.min(zoomFit * minZoomFactor, maxZoom);
  // Preferir zoom de jogo quando há mapa válido; mundo degenerado permanece em 1.
  const zoom = canFit ? clamp(Math.max(zoomFit, playZoom), minZoom, maxZoom) : 1;

  const limits: CameraLimits = {
    left: world.x - boundsPadding,
    right: world.x + world.width + boundsPadding,
    top: world.y - boundsPadding,
    bottom: world.y + world.height + boundsPadding,
  };

  return { center, zoom, minZoom, maxZoom, limits };
}
