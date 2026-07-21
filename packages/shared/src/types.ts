/**
 * Tipos utilitarios transversais.
 */

/** Identificador unico (UUID v4). Alias semantico para clareza no dominio. */
export type UUID = string;

/** Timestamps padrao presentes em todas as entidades persistidas. */
export interface Timestamps {
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Parametros de paginacao usados nas listagens. */
export interface Pagination {
  readonly skip?: number;
  readonly take?: number;
}
