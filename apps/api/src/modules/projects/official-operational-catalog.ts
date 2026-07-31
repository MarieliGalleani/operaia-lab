/**
 * Catalogo operacional oficial — Projects + bindings GitHub (sem webhook ainda).
 */
export interface OfficialOperationalWorkspace {
  readonly workspaceId: string;
  readonly name: string;
  readonly repository: string;
  readonly description: string;
}

export const OFFICIAL_OPERATIONAL_WORKSPACES: readonly OfficialOperationalWorkspace[] =
  [
    {
      workspaceId: "operaia-lab",
      name: "OperaIA.lab",
      repository: "MarieliGalleani/operaia-lab",
      description: "Evolucao continua da Equipe Digital — OperaIA.lab",
    },
    {
      workspaceId: "nexo",
      name: "NEXO",
      repository: "MarieliGalleani/operaia-core-nexo",
      description: "Finalizar desenvolvimento da NEXO",
    },
    {
      workspaceId: "infra",
      name: "Infraestrutura",
      repository: "MarieliGalleani/operaia-infra",
      description: "Infraestrutura operacional OperaIA",
    },
    {
      workspaceId: "deploy",
      name: "Deploy",
      repository: "MarieliGalleani/operaia-deploy",
      description: "Pipelines e deploy OperaIA",
    },
    {
      workspaceId: "flowgrid",
      name: "FlowGrid",
      repository: "MarieliGalleani/flowgrid",
      description: "Produto FlowGrid",
    },
    {
      workspaceId: "hexalife",
      name: "Hexalife",
      repository: "MarieliGalleani/Hexalife",
      description: "Produto Hexalife",
    },
    {
      workspaceId: "odontoclinic",
      name: "OdontoClinic",
      repository: "MarieliGalleani/OdontoClinic",
      description: "Produto OdontoClinic",
    },
    {
      workspaceId: "estocai",
      name: "Estocai",
      repository: "MarieliGalleani/estocai",
      description: "Produto Estocai",
    },
  ] as const;

export function canonicalGithubExternalRef(repository: string): string {
  return repository.trim().toLowerCase();
}
