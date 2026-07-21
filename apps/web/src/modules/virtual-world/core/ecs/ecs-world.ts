/**
 * Implementacao do ECS (armazem de entidades + componentes).
 *
 * Um Map por tipo de componente (component store) — bom equilibrio entre
 * simplicidade e performance para centenas/milhares de entidades.
 */

import type {
  ComponentBundle,
  ComponentType,
  ComponentTypeMap,
  EntityWorld,
} from "../../contracts/entities";
import type { EntityId } from "../../contracts/ids";

export class EcsWorld implements EntityWorld {
  private nextId = 1;
  private readonly alive = new Set<EntityId>();
  private readonly stores = new Map<ComponentType, Map<EntityId, unknown>>();

  create(): EntityId {
    const id = this.nextId++ as EntityId;
    this.alive.add(id);
    return id;
  }

  spawn(bundle: ComponentBundle): EntityId {
    const id = this.create();
    for (const key of Object.keys(bundle) as ComponentType[]) {
      const data = bundle[key];
      if (data !== undefined) {
        this.set(id, key, data as ComponentTypeMap[typeof key]);
      }
    }
    return id;
  }

  destroy(id: EntityId): void {
    if (!this.alive.has(id)) {
      return;
    }
    for (const store of this.stores.values()) {
      store.delete(id);
    }
    this.alive.delete(id);
  }

  isAlive(id: EntityId): boolean {
    return this.alive.has(id);
  }

  set<K extends ComponentType>(id: EntityId, type: K, data: ComponentTypeMap[K]): void {
    if (!this.alive.has(id)) {
      return;
    }
    const store = this.stores.get(type) ?? new Map<EntityId, unknown>();
    store.set(id, data);
    this.stores.set(type, store);
  }

  get<K extends ComponentType>(id: EntityId, type: K): ComponentTypeMap[K] | undefined {
    return this.stores.get(type)?.get(id) as ComponentTypeMap[K] | undefined;
  }

  has(id: EntityId, type: ComponentType): boolean {
    return this.stores.get(type)?.has(id) ?? false;
  }

  remove(id: EntityId, type: ComponentType): void {
    this.stores.get(type)?.delete(id);
  }

  query(...types: readonly ComponentType[]): readonly EntityId[] {
    if (types.length === 0) {
      return this.entities();
    }
    const stores = types.map((type) => this.stores.get(type));
    if (stores.some((store) => store === undefined)) {
      return [];
    }
    const defined = stores as Map<EntityId, unknown>[];
    let smallest = defined[0] as Map<EntityId, unknown>;
    for (const store of defined) {
      if (store.size < smallest.size) {
        smallest = store;
      }
    }
    const result: EntityId[] = [];
    for (const id of smallest.keys()) {
      if (defined.every((store) => store.has(id))) {
        result.push(id);
      }
    }
    return result;
  }

  entities(): readonly EntityId[] {
    return [...this.alive];
  }

  size(): number {
    return this.alive.size;
  }

  clear(): void {
    this.stores.clear();
    this.alive.clear();
    this.nextId = 1;
  }
}
