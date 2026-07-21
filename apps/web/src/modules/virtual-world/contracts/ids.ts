/**
 * Tipos primitivos de identidade e geometria do Mundo Virtual.
 *
 * Camada: CONTRATOS (sem implementacao). Nao importa nada da casca Vue.
 * Conceitos genericos apenas — nenhum vocabulario de negocio.
 */

/** Identificador de uma entidade no ECS. Numerico por performance. */
export type EntityId = number;

/** Coordenada em tiles (grade logica de um andar de um mapa). */
export interface TileCoord {
  readonly col: number;
  readonly row: number;
  /** Andar/nivel opcional; ausente = andar corrente. */
  readonly floorId?: string;
}

/** Dimensao de uma grade em tiles. */
export interface GridSize {
  readonly cols: number;
  readonly rows: number;
}

/** Retangulo em tiles (origem + largura/altura). */
export interface TileRect {
  readonly col: number;
  readonly row: number;
  readonly w: number;
  readonly h: number;
}

/** Ponto em coordenadas de mundo (pixels logicos). */
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

/** Retangulo em coordenadas de mundo. */
export interface WorldRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Funcao de cancelamento de inscricao/efeito. */
export type Unsubscribe = () => void;
