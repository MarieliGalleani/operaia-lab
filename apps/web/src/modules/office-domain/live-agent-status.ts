/**
 * Status ao vivo dos agentes — busca o Command Center real (mesma fonte
 * ja usada pelo dashboard) e devolve, por employeeId, se o agente esta
 * ocupado agora e em que missao.
 *
 * Chamado a cada carregamento de mapa (o motor recarrega os atores do
 * zero em toda navegacao — nao existe push continuo enquanto o usuario
 * esta parado num andar; isso fica para uma fase futura). Falha
 * silenciosa: se a chamada falhar, o andar carrega normalmente com o
 * estado padrao de cada agente, sem travar o mundo virtual.
 */

import { officeCommandClient } from "@/data/adapters/office-client";

export interface LiveAgentStatus {
  readonly busy: boolean;
  readonly objective: string | null;
}

export async function fetchLiveAgentStatus(): Promise<
  ReadonlyMap<string, LiveAgentStatus>
> {
  try {
    const command = await officeCommandClient.getCommandCenter();
    return new Map(
      command.team.map((member) => [
        member.employeeId,
        { busy: member.status === "busy", objective: member.currentObjective },
      ]),
    );
  } catch (error) {
    console.warn(
      "[office-domain] status ao vivo indisponível, usando estado padrão",
      error,
    );
    return new Map();
  }
}
