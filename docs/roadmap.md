# Roadmap — OperaIA.lab

## Fase 0 — CORE operacional (esta versão) ✅

- [x] Monorepo modular (pnpm workspaces)
- [x] Módulos: Project, Task, Agent Management
- [x] PostgreSQL + Prisma + migrations + seed
- [x] Primeiro agente: OperaIA CEO
- [x] API REST com validação Zod e tratamento central de erros
- [x] Contratos preparados para LLM, memória RAG e n8n

## Fase 1 — Inteligência dos agentes

- [ ] Implementar um `LLMProvider` concreto (`@operaia/ai-core`)
- [ ] Runtime de execução de agente (definição + LLM + contexto)
- [ ] OperaIA CEO capaz de analisar um projeto e sugerir tarefas
- [ ] Endpoint para acionar um agente sobre um projeto

## Fase 2 — Memória de longo prazo (RAG)

- [ ] `MemoryStore` com PostgreSQL + `pgvector`
- [ ] Pipeline de embeddings (ingestão e busca)
- [ ] Contexto recuperado alimentando as decisões dos agentes

## Fase 3 — Automação e orquestração

- [ ] Integração com n8n (webhooks e gatilhos)
- [ ] Agentes especialistas (ex.: conteúdo, produto, dados)
- [ ] Delegação de tarefas do CEO para especialistas

## Fase 4 — Produto

- [ ] Autenticação
- [ ] Frontend (painel do escritório virtual)
- [ ] Multi-tenant (clientes externos)

> As fases 1+ estão fora do escopo atual e servem como direção. O foco desta entrega é o cérebro inicial (CORE).
