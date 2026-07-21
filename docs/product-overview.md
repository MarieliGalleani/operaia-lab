# OperaIA.lab — Visão do Produto

## O que é

OperaIA.lab é um **escritório virtual inteligente** baseado em agentes de IA. Ele organiza e executa projetos por meio de agentes especializados coordenados por um agente central (o **OperaIA CEO**).

Não é um SaaS genérico. É um sistema operacional de trabalho: projetos, tarefas e agentes que colaboram para tirar iniciativas do papel.

## Para quem

Inicialmente, uso interno da fundadora para conduzir projetos próprios:

- **NEXO**
- **MenuFlow**
- **Plataforma**

No futuro, poderá atender clientes externos (fora do escopo desta versão).

## Conceitos centrais

| Conceito    | Descrição                                                                 |
| ----------- | ------------------------------------------------------------------------- |
| **Project** | Uma iniciativa a ser conduzida (ex.: NEXO). Tem status e prioridade.      |
| **Task**    | Unidade de trabalho de um projeto, podendo ser atribuída a um agente.     |
| **Agent**   | Um agente de IA com papel, descrição e instruções de sistema (persona).   |

## O primeiro agente: OperaIA CEO

Coordenador geral do escritório virtual. Responsabilidades:

- Analisar projetos
- Organizar prioridades
- Criar tarefas
- Coordenar os futuros agentes especialistas

## Escopo desta versão (CORE operacional)

Incluído:

- Modelagem e persistência de Projetos, Tarefas e Agentes
- API REST modular
- Seed inicial (projetos + OperaIA CEO)
- Arquitetura preparada para LLMs, memória RAG e n8n

**Fora de escopo** (propositalmente): frontend, autenticação, multi-tenant, execução autônoma de agentes.
