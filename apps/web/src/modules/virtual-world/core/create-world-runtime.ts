/**
 * Composition root do mundo: monta o runtime desacoplado.
 *
 * Unico ponto que costura bus + ECS + relogio + camera + scheduler +
 * persistencia + provider + engine. A casca Vue so conhece o WorldRuntime.
 * Suporta troca de mapa por id (portais).
 */

import type { TileCoord } from "../contracts/ids";
import type { MapManifest } from "../contracts/map";
import type { WorldRuntime, WorldRuntimeOptions } from "../contracts/world-runtime";
import { selectSpawn, spawnActorsIntoWorld } from "./actor-loader";
import { LogicalCamera } from "./camera/logical-camera";
import { SimulationClock } from "./clock/simulation-clock";
import { EcsWorld } from "./ecs/ecs-world";
import { DefaultSystemScheduler } from "./ecs/system-scheduler";
import { TypedEventBus } from "./event-bus";
import { computeMapWorldBounds } from "./geometry/iso";
import { KeyboardInput } from "./input/keyboard-input";
import { spawnLocalActor } from "./local-actor";
import { loadManifestIntoWorld } from "./map-loader";
import { createStateStore } from "./state/state-store";
import { AutoRoamSystem } from "./systems/auto-roam-system";
import { CameraFollowSystem } from "./systems/camera-follow-system";
import { KeyboardMovementSystem } from "./systems/keyboard-movement-system";
import { commandMove, MovementSystem } from "./systems/movement-system";
import { PortalSystem } from "./systems/portal-system";
import { PresenceSystem } from "./systems/presence-system";

const STATE_VERSION = 1;

/** Aviso claro de navegação (apenas em desenvolvimento; não quebra execução). */
function warnMissingSpawn(mapId: string, requestedSpawnId: string): void {
  if (import.meta.env.DEV) {
    console.warn(
      `SpawnPoint ${requestedSpawnId} não encontrado no mapa ${mapId}. Usando defaultSpawn.`,
    );
  }
}

export function createWorldRuntime(options: WorldRuntimeOptions): WorldRuntime {
  const { data, engine, scopeId, initialMapId } = options;
  const bus = options.bus ?? new TypedEventBus();
  const world = options.world ?? new EcsWorld();
  const clock = new SimulationClock(bus, { scale: options.clockScale ?? 1 });
  const camera = new LogicalCamera(bus);
  const scheduler = new DefaultSystemScheduler(world, bus, clock);
  const state = options.stateStore ?? createStateStore();

  let started = false;
  let currentMapId: string | undefined;
  let currentFloorId: string | undefined;
  let currentManifest: MapManifest | undefined;
  let localActorId: number | undefined;
  let rafId: number | undefined;
  let lastTs = 0;

  // Input de teclado (WASD + setas) para o actor local.
  const keyboard = new KeyboardInput();

  // Câmera segue o actor local (dead zone pequena + suavização de jogo).
  const cameraFollow = new CameraFollowSystem(camera, { smoothing: 12, deadZonePx: 20 });

  // Sistemas genéricos padrão: movimento (alvo + teclado), presença, câmera e portais.
  const presenceSystem = new PresenceSystem((change) => {
    persistViewState(change.to);
  });
  // NPCs (atores não-locais) ganham vida: andam e param ("trabalhando").
  const autoRoam = new AutoRoamSystem();
  scheduler.add(new MovementSystem());
  scheduler.add(new KeyboardMovementSystem(keyboard));
  scheduler.add(autoRoam);
  scheduler.add(presenceSystem);
  scheduler.add(cameraFollow);
  scheduler.add(new PortalSystem());

  // id de presença do usuário conectado (usado para persistir só o actor local).
  const localPresenceId = data.presence.getLocalActor().id;

  // Travessia: só o LOCAL actor muda a VISÃO GLOBAL de mapa. NPCs (não-locais)
  // também emitem portal:entered (evento genérico), mas não trocam a tela — o
  // domínio pode reagir a eles separadamente no futuro.
  bus.on("portal:entered", (payload) => {
    if (payload.actorId !== localPresenceId) {
      return;
    }
    // Portal para o MESMO mapa: teleporte interno (sem recarregar o mundo).
    if (payload.targetMapId === currentMapId) {
      teleportLocalActorTo(payload.targetSpawnId);
      return;
    }
    void loadMapInternal(payload.targetMapId, payload.targetSpawnId);
  });

  // Persiste a posição sempre que o actor local termina um movimento.
  bus.on("actor:moved", (payload) => {
    if (payload.actorId !== localPresenceId) {
      return;
    }
    persistViewState({
      col: Math.round(payload.to.col),
      row: Math.round(payload.to.row),
      floorId: payload.to.floorId,
    });
  });

  /** Persiste o estado visual atual (inclui o tile do actor local). */
  function persistViewState(avatarTile?: TileCoord): void {
    if (currentMapId === undefined) {
      return;
    }
    state.save({
      version: STATE_VERSION,
      scopeId,
      mapId: currentMapId,
      floorId: avatarTile?.floorId ?? currentFloorId ?? "",
      avatarTile,
      camera: camera.getState(),
      clock: clock.now(),
    });
  }

  function readLocalActorTile(): TileCoord | undefined {
    if (localActorId === undefined) {
      return undefined;
    }
    const transform = world.get(localActorId, "transform");
    if (!transform) {
      return undefined;
    }
    return {
      col: Math.round(transform.col),
      row: Math.round(transform.row),
      floorId: transform.floorId,
    };
  }

  function tick(timestamp: number): void {
    const delta = lastTs > 0 ? timestamp - lastTs : 16;
    lastTs = timestamp;
    clock.advance(delta);
    scheduler.run(delta);
    rafId = requestAnimationFrame(tick);
  }

  function startLoop(): void {
    if (typeof requestAnimationFrame === "undefined") {
      return;
    }
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop(): void {
    if (rafId !== undefined && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(rafId);
    }
    rafId = undefined;
  }

  async function loadMapInternal(mapId: string, spawnPointId?: string): Promise<void> {
    const previous = currentMapId;
    const manifest = await data.maps.getMap(mapId);

    // Valida o spawn solicitado (fallback para defaultSpawn; avisa em dev).
    const spawn = selectSpawn(manifest, spawnPointId);
    if (spawnPointId !== undefined && !spawn.existed) {
      warnMissingSpawn(manifest.id, spawnPointId);
    }

    world.clear();
    presenceSystem.reset();
    loadManifestIntoWorld(world, manifest, bus);
    const actors = await data.entities.listActors(manifest.id);
    spawnActorsIntoWorld(world, actors, manifest, bus);

    // Vida dos NPCs: reinicia o vaguear e limita destinos à grade do andar.
    autoRoam.reset();
    const primaryFloor = manifest.floors[0];
    if (primaryFloor) {
      autoRoam.setGridSize(primaryFloor.size.cols, primaryFloor.size.rows);
      // Zonas de descanso = areas com tag "rest" (dado genérico do mapa).
      const restZones = primaryFloor.areas
        .filter((a) => a.tags?.includes("rest"))
        .map((a) => ({ bounds: a.bounds, floorId: primaryFloor.id }));
      autoRoam.setRestZones(restZones);
    }

    // Actor local (usuário conectado): sempre presente, nasce no spawn do mapa.
    const localActor = data.presence.getLocalActor();
    localActorId = spawnLocalActor(world, localActor, manifest, bus, spawn.spawnId);

    // Câmera acompanha o actor local, limitada aos limites do mapa.
    camera.setBounds(computeMapWorldBounds(manifest));
    cameraFollow.setTileSize(manifest.tileWidth, manifest.tileHeight);
    cameraFollow.setTarget(localActorId);
    cameraFollow.snapToTarget(world);

    await engine.loadMap(manifest);
    currentManifest = manifest;
    currentMapId = manifest.id;
    currentFloorId = readLocalActorTile()?.floorId ?? manifest.defaultSpawn.floorId;
    bus.emit("map:loaded", { mapId: manifest.id });
    if (previous !== undefined && previous !== manifest.id) {
      bus.emit("map:changed", { fromMapId: previous, toMapId: manifest.id });
    }
    // Persiste a posição inicial (spawnPoint) do actor local no runtime.
    persistViewState(readLocalActorTile());
    // Chegada de alto nível do actor local (ponto de extensão do domínio).
    bus.emit("map:entered", { actorId: localPresenceId, mapId: manifest.id, spawnId: spawn.spawnId });
  }

  /**
   * Teleporte interno do actor local dentro do MESMO mapa: apenas reposiciona o
   * Transform no spawn destino, sem recarregar o mundo. Mantém câmera e estado.
   */
  function teleportLocalActorTo(spawnId: string): void {
    if (localActorId === undefined || currentManifest === undefined) {
      return;
    }
    const spawn = selectSpawn(currentManifest, spawnId);
    if (!spawn.existed) {
      warnMissingSpawn(currentManifest.id, spawnId);
    }
    const transform = world.get(localActorId, "transform");
    if (!transform) {
      return;
    }
    transform.col = spawn.point.col;
    transform.row = spawn.point.row;
    transform.floorId = spawn.point.floorId;
    if (spawn.point.facing) {
      transform.facing = spawn.point.facing;
    }
    const movable = world.get(localActorId, "movable");
    if (movable) {
      movable.moving = false;
      movable.target = undefined;
    }
    presenceSystem.reset();
    currentFloorId = spawn.point.floorId;
    cameraFollow.snapToTarget(world);
    persistViewState(readLocalActorTile());
    bus.emit("map:entered", {
      actorId: localPresenceId,
      mapId: currentMapId ?? currentManifest.id,
      spawnId: spawn.spawnId,
    });
  }

  return {
    scopeId,
    providerKind: data.kind,

    get currentMapId(): string | undefined {
      return currentMapId;
    },

    bus,
    world,
    clock,
    camera,
    scheduler,
    state,
    engine,

    get localActorId(): number | undefined {
      return localActorId;
    },

    getLocalActorTile(): TileCoord | undefined {
      return readLocalActorTile();
    },

    moveLocalActorTo(tile: TileCoord): void {
      if (localActorId === undefined) {
        return;
      }
      commandMove(world, localActorId, tile);
    },

    teleportLocalActorTo(spawnId: string): void {
      teleportLocalActorTo(spawnId);
    },

    zoomCameraBy(factor: number): void {
      camera.zoomTo(camera.getState().zoom * factor);
    },

    recenterCamera(): void {
      cameraFollow.setEnabled(true);
      cameraFollow.snapToTarget(world);
    },

    setCameraFollow(enabled: boolean): void {
      cameraFollow.setEnabled(enabled);
      if (enabled) {
        cameraFollow.snapToTarget(world);
      }
    },

    get started(): boolean {
      return started;
    },

    async start(container: HTMLElement): Promise<void> {
      if (started) {
        return;
      }
      await engine.init({ container, bus, world, clock, camera, assets: data.assets });
      if (typeof window !== "undefined") {
        keyboard.attach(window);
      }
      await loadMapInternal(initialMapId);
      clock.start();
      startLoop();
      started = true;
      bus.emit("world:ready", { engine: engine.id });
    },

    async loadMap(mapId: string): Promise<void> {
      await loadMapInternal(mapId);
    },

    dispose(): void {
      stopLoop();
      keyboard.detach();
      clock.stop();
      engine.destroy();
      started = false;
      currentMapId = undefined;
      currentFloorId = undefined;
      currentManifest = undefined;
      localActorId = undefined;
      bus.emit("world:disposed", {});
      bus.clear();
    },
  };
}
