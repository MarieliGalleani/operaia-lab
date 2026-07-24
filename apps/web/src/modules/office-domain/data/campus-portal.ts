/**
 * Helper de portal para mapas do Campus (dado de domínio).
 */

import type { EntityBlueprint } from "../../virtual-world/contracts/map";

export function campusPortal(params: {
  readonly id: string;
  readonly col: number;
  readonly row: number;
  readonly targetMapId: string;
  readonly targetSpawnId: string;
  readonly label: string;
  readonly interactLabel?: string;
}): EntityBlueprint {
  return {
    id: params.id,
    ref: "portal-door",
    components: {
      transform: { col: params.col, row: params.row },
      renderable: { spriteId: "door", layer: "walls", visible: true },
      portal: {
        portalId: params.id,
        target: { mapId: params.targetMapId, spawnPointId: params.targetSpawnId },
        mode: "walk",
        label: params.label,
      },
      interactable: {
        kind: "portal",
        radiusTiles: 1,
        enabled: true,
        label: params.interactLabel ?? params.label,
      },
    },
  };
}
