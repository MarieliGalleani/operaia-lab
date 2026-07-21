/**
 * Esquema do MAPA orientado a dados (generico).
 *
 * A engine carrega QUALQUER mapa a partir destes dados — escritorio, campus,
 * laboratorio, datacenter, etc. Nenhum mapa e implementado em codigo.
 * Portas/elevadores sao apenas entidades com o componente `portal`.
 */

import type {
  AnimationComponent,
  Direction,
  InteractableComponent,
  MovableComponent,
  PortalComponent,
  PresenceComponent,
  RenderableComponent,
  StateComponent,
  TransformComponent,
} from "./components";
import type { GridSize, TileRect } from "./ids";

/** Componentes descritos como dado para instanciar uma entidade. Serializavel. */
export interface BlueprintComponents {
  transform: { col: number; row: number } & Partial<TransformComponent>;
  renderable?: RenderableComponent;
  interactable?: InteractableComponent;
  portal?: PortalComponent;
  state?: StateComponent;
  animation?: AnimationComponent;
  presence?: PresenceComponent;
  movable?: MovableComponent;
}

/** Descricao data-driven de uma entidade a ser criada no mundo. */
export interface EntityBlueprint {
  readonly id?: string;
  /** Referencia a um prefab/asset (ex.: "desk", "portal-door", "plant"). */
  readonly ref: string;
  readonly components: BlueprintComponents;
}

/** Lado de uma parede traseira do recinto (só as bordas ao fundo são desenhadas). */
export type WallSide = "n" | "w";

/** Abertura numa parede (porta/janela): posição/largura em fração da aresta (0..1). */
export interface WallOpening {
  readonly side: WallSide;
  /** Início da abertura ao longo da aresta (0..1). */
  readonly at: number;
  /** Largura da abertura (fração da aresta). */
  readonly width?: number;
}

/**
 * Enclausuramento GENÉRICO de um recinto (paredes/portas/janelas + piso).
 * A engine só desenha formas a partir destes dados — sem semântica de negócio.
 */
export interface AreaEnclosure {
  readonly walls?: boolean;
  /** Cor de acento das paredes (identidade do recinto). */
  readonly color?: number;
  /** Cor do piso do recinto (blend sobre o piso base). */
  readonly floorColor?: number;
  readonly doors?: readonly WallOpening[];
  readonly windows?: readonly WallOpening[];
}

/** Regiao/recinto do mapa. `kind` e string de dado (a engine nao interpreta). */
export interface AreaBlueprint {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly bounds: TileRect;
  readonly tags?: readonly string[];
  readonly decorations: readonly EntityBlueprint[];
  /** Paredes/portas/janelas/piso do recinto (opcional, genérico). */
  readonly enclosure?: AreaEnclosure;
}

/** Ponto de entrada nomeado em um andar. */
export interface SpawnPointDef {
  readonly id: string;
  readonly col: number;
  readonly row: number;
  readonly facing?: Direction;
}

/** Matriz de navegacao (1 = caminhavel, 0 = obstaculo). Opcional; pode ser derivada. */
export interface NavGridDef {
  readonly cols: number;
  readonly rows: number;
  readonly walkable: readonly (readonly number[])[];
}

/** Um andar/nivel de um mapa. */
export interface FloorDef {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly size: GridSize;
  readonly areas: readonly AreaBlueprint[];
  /** Entidades soltas do andar (portais, objetos, decoracao de corredor). */
  readonly entities: readonly EntityBlueprint[];
  readonly spawnPoints: readonly SpawnPointDef[];
  readonly navGrid?: NavGridDef;
}

/** Ambiente sonoro/iluminacao — reservado para o futuro. */
export interface MapAmbient {
  readonly musicId?: string;
  readonly lightingId?: string;
}

/** Regras do mapa (extensivel). */
export interface MapRules {
  readonly interactionRadiusTiles?: number;
}

/** Manifesto completo de um mapa (qualquer ambiente). */
export interface MapManifest {
  readonly id: string;
  readonly name: string;
  /** Tema/identidade visual (assets) a carregar para este mapa. */
  readonly themeId: string;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly floors: readonly FloorDef[];
  /** Onde o ator aparece ao entrar no mapa sem portal de origem. */
  readonly defaultSpawn: { readonly floorId: string; readonly spawnPointId: string };
  readonly rules?: MapRules;
  readonly ambient?: MapAmbient;
}

/** Resumo leve de mapa para catalogos/listagens. */
export interface MapSummary {
  readonly id: string;
  readonly name: string;
  readonly themeId: string;
}
