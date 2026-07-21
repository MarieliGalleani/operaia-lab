/**
 * Configuracao padrao do Mundo Virtual (generica).
 *
 * Nenhum valor de negocio hardcoded na engine; escopos/mapas vem por dados.
 */

export const WORLD_CONFIG = {
  /** Escopo default (empresa/projeto). Multiempresa/multiprojeto-ready. */
  defaultScopeId: "operaia",
  /** Mapa default a carregar quando nenhum e informado. */
  defaultMapId: "sandbox",
  /** Motor grafico default (Fase 1 = PixiJS). Use "null" para headless/testes. */
  defaultEngineId: "pixi" as const,
  /** Aceleracao do relogio simulado (1 = tempo real). */
  clockScale: 60,
  /** Versao do estado visual persistido. */
  stateVersion: 1,
  /** Zoom inicial da camera. */
  defaultZoom: 1,
} as const;

export type WorldConfig = typeof WORLD_CONFIG;
