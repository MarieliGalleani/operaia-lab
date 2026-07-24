# Opera Campus — Baseline Arquitetural v1.0

**Documento oficial de referência**  
**Versão:** 1.0  
**Status:** LOCKED  
**Origem:** Fase 1 (MVP espacial) concluída · testes 93/93  
**Complementar:** `docs/opera-campus-fase-1.md` (plano de entrega da Fase 1)  
**Adendo (aguardando aprovação):** [`opera-campus-adendo-hub-vertical.md`](opera-campus-adendo-hub-vertical.md) — hub = hall + elevador · um Residente por andar (proposta Baseline v1.1)

Este documento registra as decisões aprovadas, os princípios, os limites e as regras que **não podem ser quebradas** sem nova revisão arquitetural.

---

## 1. Visão Geral

O **Opera Campus** é, oficialmente:

- o **mundo virtual corporativo** do produto;
- a **infraestrutura compartilhada** que conecta Residentes;
- o **ponto de entrada** do mundo virtual (grafo de mapas — não uma rota HTTP específica).

O Campus **não** representa uma empresa, instituição ou sede.  
Ele não possui equipe operacional própria no sentido de Residente.  
Ele **não** é um open office único nem um escritório compartilhado entre organizações.

Modelo mental:

> O Opera Campus é o condomínio.  
> Cada Residente ocupa a própria sede.  
> Áreas compartilhadas pertencem ao Campus; sedes pertencem aos Residentes.

Residentes atuais na Baseline v1.0:

- **OperaIA.lab** — sede integrada (maquete preservada).
- **Geraí** — sede integrada (entrada oficial + interior existente).

A arquitetura espacial assenta em **MapManifest + Portal** sobre a engine genérica `virtual-world`.

---

## 2. Princípios Arquiteturais

1. **Engine totalmente genérica** — `virtual-world` (Runtime, ECS, Portal System, contratos) não conhece OperaIA.lab, Geraí nem regras de negócio de Residentes.
2. **Organizações são Residentes** — “empresa” é um tipo possível de Residente; o Campus é plataforma aberta a outros tipos (pesquisa, hub, universidade, órgão público, etc.).
3. **O Campus não conhece regras internas dos Residentes** — cultura, processos, memória, funcionários e tipologias de sede são do Residente.
4. **Residentes não conhecem a implementação do Campus** — conectam-se por contratos (mapas, entrada, portais, catálogo).
5. **Navegação baseada em grafo de portais** — `mapId` + `spawnPointId`; sem lógica de negócio na engine.
6. **Crescimento por composição** — novos mapas e registros; nunca fork da engine.
7. **Nunca reconstruir sedes existentes** — a maquete OperaIA.lab e estruturas já entregues da Geraí preservam identidade.
8. **Expandir sempre adicionando novos mapas** — expansão espacial = novos manifests + arestas no grafo.
9. **Princípio da Independência** — cada Residente pode nascer, evoluir, crescer, mudar ou ser removido sem impacto estrutural nos demais; interação entre Residentes só via contratos do Campus.
10. **Arquitetura da sede pertence ao Residente** — o Campus nunca impõe tipologia (torre, prédio, escritório, galpão, laboratório, etc.).
11. **Recepção apenas recebe** — distribuição para Residentes ocorre **exclusivamente** na Praça Central.
12. **Praça Central é hub dinâmico** — preparada para qualquer quantidade de Residentes via registro de entradas, não via redesign da praça.
13. **Domínio não contamina a engine** — guarda: `virtual-world` ↛ `office-domain` (ou domínio espacial equivalente).

---

## 3. Estrutura Oficial

```
Opera Campus
├── Áreas Compartilhadas
│   ├── Recepção Principal   (campus-reception)
│   └── Praça Central        (campus-plaza)  ← hub de distribuição
│
└── Residentes
    ├── OperaIA.lab
    │   └── sede (office) — maquete preservada
    ├── Geraí
    │   ├── entrada oficial (gerai-entrance)
    │   └── interior atual (gerai-f2)
    └── futuros Residentes…
```

### Contrato conceitual de um Residente

Cada Residente possui (conceito de produto; nem todos os campos estão persistidos na v1.0):

- identidade · cultura · branding · mapas · sede · funcionários · memória · processos · ativos · permissões · configurações

### Tipologia

Cada Residente define a **própria** arquitetura de sede.

O Campus **nunca** impõe:

- torre  
- prédio  
- escritório  
- galpão  
- laboratório  
- ou qualquer outra tipologia  

### Grafo canônico (v1.0)

```
campus-reception  ↔  campus-plaza
                          ├─→ office (OperaIA.lab)  ↔  praça
                          └─→ gerai-entrance  ↔  gerai-f2

Atalho de migração (temporário): office ↔ gerai-f2
```

### Responsabilidades por camada

| Camada | Responsabilidade | Não faz |
|--------|------------------|---------|
| **virtual-world** | ECS, Runtime, portais, render, contratos genéricos | Conhecer Residentes ou regras de negócio |
| **Domínio espacial** | MapManifests, catálogo, atores por mapa, registro de entradas | Embutir lógica na engine |
| **Campus (infra)** | Áreas compartilhadas + conexão | Impor tipologias ou processos de Residentes |
| **Residente** | Seus mapas, equipe, cultura, processos | Depender estruturalmente de outro Residente |
| **Casca de produto (rotas/UI)** | Escolher mapa inicial do mundo | Definir a arquitetura do mundo (o grafo é a arquitetura) |

---

## 4. Componentes Congelados

Considerados **estáveis** na Baseline v1.0. Qualquer mudança estrutural exige **nova revisão arquitetural aprovada**.

| Componente | Notas |
|------------|--------|
| Runtime / World Runtime | Composition root do mundo; `loadMap` / clear ECS |
| ECS | Stores genéricos; sem conceitos de Campus/Residente |
| Portal System | Overlap → `portal:entered` → troca de mapa |
| MapManifest / FloorDef / Area | Contrato de dados espaciais |
| Portal Contracts | `target: { mapId, spawnPointId }` |
| World Builder / map-loader | Manifest → ECS |
| Grafo de navegação canônico | Recepção ↔ Praça ↔ sedes |
| Estrutura do Campus | Áreas compartilhadas + Residentes |
| Guarda de arquitetura | Engine ↛ domínio |
| Extensão de Residentes na praça | Via registro (`campus-resident-entrances`), não geometria hardcoded da praça |

---

## 5. Regras de Expansão

Um **novo Residente** deve exigir apenas:

1. registro dos **mapas** do Residente;  
2. registro da **entrada** (fachada / spawn na praça);  
3. registro dos **portais** (aresta praça ↔ sede);  
4. registro no **catálogo** do `MapProvider`.

**Sem modificar:**

- Praça Central (geometria / mapa base);  
- Recepção Principal;  
- mapas de outros Residentes;  
- Engine (`virtual-world`).

Critério de aceite permanente:

> Um novo Residente integra-se por composição de dados e portais, sem editar mapas Campus já existentes nem a engine.

---

## 6. Limites da Baseline

A v1.0 **não** contempla (próximas fases):

- multiplayer / presença remota;  
- persistência multiempresa / Tenant no banco;  
- autenticação;  
- permissões / membership;  
- economia;  
- IA compartilhada do Campus;  
- novos prédios / sedes além do grafo atual;  
- novos funcionários de produto (além dos mocks espaciais já existentes);  
- remoção definitiva do atalho Lab ↔ Geraí;  
- correções de auditoria de painéis `/office` (fora do escopo espacial da Baseline).

---

## 7. Roadmap Arquitetural

Direção futura **apenas** (sem detalhe de implementação):

| Fase | Direção |
|------|---------|
| **Fase 2** | Consolidação da OperaIA.lab |
| **Fase 3** | Consolidação da Geraí |
| **Fase 4** | Áreas compartilhadas |
| **Fase 5** | Novos Residentes |
| **Fase 6** | Persistência Multiempresa |
| **Fase 7** | Multiplayer |

---

## 8. Arquitetura Congelada

```
═══════════════════════════════════════════════════════════
  BASELINE OPERA CAMPUS v1.0
  STATUS: LOCKED
═══════════════════════════════════════════════════════════
```

**Significado:**

- A arquitetura desta versão é considerada **estável**.
- Novas funcionalidades devem **evoluir sobre esta base**.
- **Nenhuma alteração estrutural** deverá ocorrer sem uma **nova revisão arquitetural aprovada**.
- Implementações futuras devem respeitar os princípios, o grafo, os componentes congelados e as regras de expansão deste documento.

---

*Documento de consolidação — sem alteração de código associada. Referência obrigatória para fases seguintes.*
