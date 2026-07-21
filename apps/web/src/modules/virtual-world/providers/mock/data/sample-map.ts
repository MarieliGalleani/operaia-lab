/**
 * Mapa generico de exemplo ("sandbox").
 *
 * Existe apenas para provar que a engine carrega QUALQUER mapa por dados, sem
 * conhecer nenhum ambiente especifico. O escritorio NAO vive aqui — vive na
 * camada de dominio (office-domain).
 */

import type { MapManifest } from "../../../contracts/map";

export const SAMPLE_MAP: MapManifest = {
  id: "sandbox",
  name: "Sandbox",
  themeId: "sandbox",
  tileWidth: 64,
  tileHeight: 32,
  floors: [
    {
      id: "ground",
      name: "Ground",
      level: 0,
      size: { cols: 10, rows: 10 },
      areas: [
        {
          id: "lobby",
          name: "Lobby",
          kind: "generic",
          bounds: { col: 1, row: 1, w: 6, h: 6 },
          decorations: [],
        },
      ],
      entities: [
        {
          ref: "portal",
          components: {
            transform: { col: 8, row: 5 },
            portal: {
              portalId: "to-office",
              target: { mapId: "office", spawnPointId: "reception" },
              mode: "walk",
              label: "Escritorio",
            },
            interactable: { kind: "portal", radiusTiles: 1, enabled: true, label: "Portal" },
          },
        },
      ],
      spawnPoints: [{ id: "start", col: 2, row: 2 }],
    },
  ],
  defaultSpawn: { floorId: "ground", spawnPointId: "start" },
};
