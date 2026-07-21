/**
 * Pipeline de ASSETS por TEMA, separado do codigo.
 *
 * Cada mapa referencia um `themeId`; o `AssetProvider` entrega o manifesto de
 * assets daquele tema. Nenhum asset fica hardcoded.
 */

export interface SpritesheetRef {
  readonly id: string;
  readonly imageUrl: string;
  readonly atlasUrl?: string;
  /** Ponto de ancoragem normalizado (0..1) do sprite (ex.: pés do personagem). */
  readonly anchorX?: number;
  readonly anchorY?: number;
}

export interface TilesetRef {
  readonly id: string;
  readonly imageUrl: string;
  /** Largura/altura do FOOTPRINT (losango) do tile na imagem de origem. */
  readonly tileWidth: number;
  readonly tileHeight: number;
  /** Ponto de ancoragem normalizado (0..1): centro do losango dentro da imagem. */
  readonly anchorX?: number;
  readonly anchorY?: number;
}

export interface AssetManifest {
  /** Coincide com o `themeId` referenciado pelos mapas. */
  readonly id: string;
  readonly spritesheets: readonly SpritesheetRef[];
  readonly tilesets: readonly TilesetRef[];
}

export interface AssetProvider {
  getManifest(themeId: string): Promise<AssetManifest>;
}
