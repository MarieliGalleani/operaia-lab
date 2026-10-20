/**
 * Catalogo operacional oficial — Projects + bindings GitHub (sem webhook ainda).
 */
export interface OfficialOperationalWorkspace {
  readonly workspaceId: string;
  readonly name: string;
  readonly repository: string;
  readonly description: string;
  /** Branch/ref GitHub operacional do workspace (configJson.operationalRef). */
  readonly operationalRef?: string;
  /**
   * lab = estrutura do proprio escritorio; client = produto/cliente;
   * site = site publico; design = design system / arquivos de design.
   */
  readonly kind: "lab" | "client" | "site" | "design";
}

export const OFFICIAL_OPERATIONAL_WORKSPACES: readonly OfficialOperationalWorkspace[] =
  [
    {
      workspaceId: "operaia-lab",
      name: "OperaIA.lab",
      repository: "MarieliGalleani/operaia-lab",
      description: "Evolucao continua da Equipe Digital — OperaIA.lab",
      operationalRef: "lab",
      kind: "lab",
    },
    {
      workspaceId: "nexo",
      name: "NEXO",
      repository: "MarieliGalleani/operaia-core-nexo",
      description: "Finalizar desenvolvimento da NEXO",
      kind: "client",
    },
    {
      workspaceId: "infra",
      name: "Infraestrutura",
      repository: "MarieliGalleani/operaia-infra",
      description: "Infraestrutura operacional OperaIA",
      kind: "lab",
    },
    {
      workspaceId: "deploy",
      name: "Deploy",
      repository: "MarieliGalleani/operaia-deploy",
      description: "Pipelines e deploy OperaIA",
      kind: "lab",
    },
    {
      workspaceId: "flowgrid",
      name: "FlowGrid",
      repository: "MarieliGalleani/flowgrid",
      description: "Produto FlowGrid",
      kind: "client",
    },
    {
      workspaceId: "hexalife",
      name: "Hexalife",
      repository: "MarieliGalleani/Hexalife",
      description: "Produto Hexalife",
      kind: "client",
    },
    {
      workspaceId: "odontoclinic",
      name: "OdontoClinic",
      repository: "MarieliGalleani/OdontoClinic",
      description: "Produto OdontoClinic",
      kind: "client",
    },
    {
      workspaceId: "estocai",
      name: "Estocai",
      repository: "MarieliGalleani/estocai",
      description: "Produto Estocai",
      kind: "client",
    },
    // ---- Interface 3.0: repositorios do GitHub que faltavam no escritorio ----
    {
      workspaceId: "podiario",
      name: "Podiário",
      repository: "MarieliGalleani/agenda-operaia",
      description: "Gestão para clínicas de podologia (ex-Agenda OperaIA), com o painel Central",
      kind: "client",
    },
    {
      workspaceId: "podiario-site",
      name: "Podiário Site",
      repository: "MarieliGalleani/podiario-site",
      description: "Site público do Podiário (página inicial, Privacidade e Termos)",
      kind: "site",
    },
    {
      workspaceId: "operaia-host",
      name: "OperaIA Host",
      repository: "MarieliGalleani/operaia-host",
      description: "Painel de hospedagem de sites: deploy, monitoramento e isolamento por cliente",
      kind: "lab",
    },
    {
      workspaceId: "atlas-operaia",
      name: "Atlas OperaIA",
      repository: "MarieliGalleani/atlas-operaIA",
      description: "Produto OperaIA Atlas",
      kind: "client",
    },
    {
      workspaceId: "cardapio",
      name: "Cardápio",
      repository: "MarieliGalleani/cardapio-",
      description: "Cardápio digital",
      kind: "client",
    },
    {
      workspaceId: "portfolio",
      name: "Portfólio",
      repository: "MarieliGalleani/marieligalleani-portfolio",
      description: "Portfólio pessoal da Marieli",
      kind: "site",
    },
    {
      workspaceId: "curriculo",
      name: "Currículo",
      repository: "MarieliGalleani/curriculo",
      description: "Currículo online da Marieli",
      kind: "site",
    },
    {
      workspaceId: "opera-core-figma",
      name: "Opera Core Figma",
      repository: "MarieliGalleani/opera-core-figma",
      description: "Arquivos e componentes de design do Opera Core",
      kind: "design",
    },
    {
      workspaceId: "ds-onii",
      name: "Design System Onii",
      repository: "MarieliGalleani/ds-onii",
      description: "Documentação do Design System Onii (Vue 3 + Vuetify)",
      kind: "design",
    },
  ] as const;

export function canonicalGithubExternalRef(repository: string): string {
  return repository.trim().toLowerCase();
}
