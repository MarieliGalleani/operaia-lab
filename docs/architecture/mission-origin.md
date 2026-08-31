# Mission.origin — premissa e escopo (P1.2B)

## Premissa

`Mission` histórico **não é** fonte de verdade de produtividade, backlog ou
existência de projeto. A auditoria P1.2 encontrou ~43.046 missões raiz no
banco operacional, das quais ~99,6% são resíduo de testes/harness rodados
contra o banco operacional entre 30/07 e 10/08/2026 (workspace `nexo`,
padrão `[COORDINATE/...]`). Esse histórico permanece intocado — sem
`UPDATE`, sem `DELETE`, sem reinterpretação — e não alimenta nenhuma
experiência de produto.

Fonte de verdade de "o que existe": `Project` + `WorkspaceSourceBinding` +
`WorkspaceGithubSnapshot` (GitHub). `Mission` é mecanismo de execução.

## O que `origin` classifica

Só a Mission **raiz** (`parentMissionId IS NULL`) recebe `origin`, atribuído
exclusivamente pelo produtor que causa a criação — nunca por heurística de
`objective`, timestamp, workspace ou padrão de texto:

| Produtor | `origin` |
|---|---|
| `submit-demand-to-core.ts` (Nova Demanda) | `HUMAN_DEMAND` |
| `runtime.routes.ts` `POST /missions` (Nova Missão avançado) | `HUMAN_ADVANCED` |
| `operational-mission-service.ts` (Sala da Opera) | `CEO_SALA` |
| `mission-scheduler.ts` `runScheduleRulesCycle` (gatilho configurado) | `SCHEDULE_RULE` |
| `mission-scheduler.ts` `runCycle` (auto-coordenação por backlog) | `SUPERVISOR_AUTO` |
| `coordination-dispatcher.ts` (coordenação por sinal interno do Supervisor) | `SUPERVISOR_AUTO` |
| `signal-mission-converter.ts` (Domain Signal do GitHub) | `SIGNAL_GITHUB` |

Missões filhas (`EXECUTE`, `CONSOLIDATE`, follow-up técnico pós-delivery)
**não** recebem `origin` próprio — o campo fica `null` nelas. O andar de
uma filha é sempre resolvido subindo até a raiz (`parentMissionId`), e essa
resolução acontece **só no backend** (`originToFloor()` em
`apps/api/src/modules/runtime/mission-origin.ts`) — o frontend nunca
reimplementa a regra nem percorre a árvore.

## `origin = NULL`

Significa **origem desconhecida ou legado não classificado** — nunca
"desenvolvimento" por padrão. `originToFloor(null)` retorna `"UNKNOWN"`,
não `"DEVELOPMENT"`. Não existe backfill nesta fase: as ~43.046 missões
históricas ficam com `origin = NULL` e não são usadas para inferir andar,
saúde ou volume de trabalho.

## Escopo desta fase (P1.2B)

Preparação apenas: schema + migration criada (não aplicada) + produtores +
`originToFloor()`. Nenhum DTO do frontend foi alterado para expor `origin`
ainda — nenhuma tela consome o campo nesta fase; isso é trabalho da Fase 3
("Meu Trabalho"), que já vai precisar tocar nesses contratos de qualquer
forma para os agrupamentos por estado.
