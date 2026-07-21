/**
 * Contrato do ECS (Entity Component System) generico.
 *
 * Uma entidade = id + componentes. Sem heranca, sem tipos fixos de negocio.
 */

import type {
  AnimationComponent,
  AreaComponent,
  InteractableComponent,
  MovableComponent,
  PortalComponent,
  PresenceComponent,
  RenderableComponent,
  StateComponent,
  TransformComponent,
} from "./components";
import type { EntityId } from "./ids";

/** Mapa tipo-de-componente -> forma do dado. Fonte unica de verdade do ECS. */
export interface ComponentTypeMap {
  transform: TransformComponent;
  renderable: RenderableComponent;
  movable: MovableComponent;
  interactable: InteractableComponent;
  area: AreaComponent;
  portal: PortalComponent;
  state: StateComponent;
  animation: AnimationComponent;
  presence: PresenceComponent;
}

export type ComponentType = keyof ComponentTypeMap;

/** Conjunto parcial de componentes para criar entidades a partir de dados. */
export type ComponentBundle = {
  [K in ComponentType]?: ComponentTypeMap[K];
};

/** Armazem de entidades. Implementacao vive em `core/ecs`. */
export interface EntityWorld {
  create(): EntityId;
  spawn(bundle: ComponentBundle): EntityId;
  destroy(id: EntityId): void;
  isAlive(id: EntityId): boolean;

  set<K extends ComponentType>(id: EntityId, type: K, data: ComponentTypeMap[K]): void;
  get<K extends ComponentType>(id: EntityId, type: K): ComponentTypeMap[K] | undefined;
  has(id: EntityId, type: ComponentType): boolean;
  remove(id: EntityId, type: ComponentType): void;

  /** Entidades que possuem TODOS os componentes informados. */
  query(...types: readonly ComponentType[]): readonly EntityId[];
  entities(): readonly EntityId[];
  size(): number;
  clear(): void;
}
