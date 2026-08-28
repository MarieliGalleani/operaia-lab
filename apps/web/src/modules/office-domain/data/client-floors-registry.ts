/**
 * Registro dos andares de clientes reais — gerados uma vez a partir da
 * fabrica (client-floor-map.ts) para cada cliente oficial real. Adicionar
 * cliente novo = uma linha aqui, nada mais (mapas do Campus nao mudam).
 *
 * Fonte dos clientes: official-operational-catalog.ts (workspaces
 * classificados como "client" em workspace-catalog.ts no backend —
 * operaia-lab/infra/deploy sao internos do Lab, nao viram andar de cliente).
 */

import { buildClientFloor, type ClientFloorBuild } from "./client-floor-map";

interface ClientDef {
  readonly workspaceId: string;
  readonly displayName: string;
}

const REAL_CLIENTS: readonly ClientDef[] = [
  { workspaceId: "nexo", displayName: "NEXO" },
  { workspaceId: "flowgrid", displayName: "FlowGrid" },
  { workspaceId: "hexalife", displayName: "Hexalife" },
  { workspaceId: "odontoclinic", displayName: "OdontoClinic" },
  { workspaceId: "estocai", displayName: "Estocai" },
];

export const CLIENT_FLOORS: readonly ClientFloorBuild[] = REAL_CLIENTS.map(
  (client, index) =>
    buildClientFloor({
      workspaceId: client.workspaceId,
      displayName: client.displayName,
      level: index + 2, // 0 = sede, 1 reservado, clientes a partir do 2º andar
      paletteIndex: index,
    }),
);
