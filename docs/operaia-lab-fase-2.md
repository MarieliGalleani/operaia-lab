# OperaIA.lab — Fase 2 · Plano Técnico (Consolidação da Sede)

**Tipo:** arquitetura e planejamento · **sem implementação**  
**Status:** aguardando aprovação  
**Referência obrigatória:** [`docs/opera-campus-baseline-v1.md`](opera-campus-baseline-v1.md) (LOCKED)  
**Em caso de conflito:** a Baseline v1.0 prevalece.

---

## 1. Papel da OperaIA.lab

A **OperaIA.lab** é:

| Dimensão | Definição oficial |
|----------|-------------------|
| No Campus | Um **Residente** do Opera Campus (empresa residente — primeiro modelo completo) |
| No produto | A **sede principal** da plataforma OperaIA |
| Na operação | O **ambiente de trabalho** da equipe digital (CEO, CTO, produto, design, marketing, etc.) |
| Na arquitetura | O **primeiro modelo completo de sede operacional** — referência para futuros Residentes |

### Responsabilidade na arquitetura

- Possuir e governar **seus próprios mapas**, identidade, cultura, equipe, memória e processos (contrato de Residente da Baseline).
- Conectar-se ao Campus **apenas** pelos contratos de entrada/portais/catálogo — sem depender estruturalmente de outros Residentes.
- Oferecer a **experiência operacional** do produto (equipe, projetos, missões, salas funcionais) **sem** substituir o Campus nem contaminar a engine.
- Preservar a **maquete espacial existente** — consolidar por integração, nunca por reconstrução (Baseline §2).

A OperaIA.lab **não** é o mundo. O mundo é o Opera Campus.  
A OperaIA.lab é a sede onde o trabalho digital da plataforma acontece.

---

## 2. Objetivos da Fase 2

Objetivos **apenas arquiteturais** (não são tarefas de código nesta missão):

1. **Consolidar o papel da sede** — OperaIA.lab como Residente operacional completo, distinto do Campus.
2. **Consolidar a navegação conceitual da sede** — do Campus aos ambientes e às funcionalidades, sem redesenhar o grafo congelado da Baseline.
3. **Integrar experiência espacial e operacional** — definir como mapa e produto coexistem (regra oficial §4).
4. **Definir responsabilidades dos ambientes** — o que cada zona da sede representa no produto (conceitualmente).
5. **Estabelecer padrões reutilizáveis** — contratos e padrões de sede que futuros Residentes possam adotar **sem** serem obrigados a copiar a tipológia Lab.
6. **Clarificar fronteiras** — o que é Lab vs Campus vs outros Residentes vs áreas compartilhadas.

**Fora destes objetivos:** expandir o Campus, criar mapas/salas/funcionários, alterar engine/Baseline.

---

## 3. Estrutura Conceitual da Sede

Organização **conceitual** da OperaIA.lab (não implica novos mapas nesta fase):

```
Entrada da sede (a partir do Campus)
        ↓
    Recepção Lab
        ↓
    Direção / Sala da CEO
        ↓
    Ambientes de trabalho
        ├── Equipe
        ├── Workspace / Projetos
        ├── Laboratório / Inovação
        ├── Reuniões
        └── Lounge / zonas de apoio
        ↓
    Centro de Operações
        (visão operacional: missões, atividades, orquestração)
```

### Notas

- A maquete espacial atual (recepção, CEO, reunião, workspace, lab IA, lounge) **já materializa** parte desta estrutura; a Fase 2 **não** manda recriá-la.
- Ambientes conceituais podem mapear 1:1 a uma área do mapa, a uma página de produto, ou a ambos — conforme §4.
- “Centro de Operações” é capacidade de produto/operação, não necessariamente um novo tile.

---

## 4. Relação entre Espaço e Produto

### Regra oficial da arquitetura (Fase 2)

| Afirmação | Significado |
|-----------|-------------|
| O **mapa** representa o espaço físico | Lugares, circulação, presença, atmosfera da sede |
| As **páginas** representam funcionalidades | Chat, equipe, projetos, workspace, atividades, configurações |
| Uma **sala pode abrir** uma funcionalidade | Ponte opcional espaço → produto (ex.: Sala CEO → conversa com Opera) |
| Uma **funcionalidade pode existir sem mapa** | Ex.: Central de atividades, Conhecimento — válidas sem tile dedicado |
| O **mapa nunca substitui** o sistema | Missões, dados, API e orquestração não vivem “só no Pixi” |
| O **sistema nunca depende** do mapa | API, Employee Framework e painéis funcionam sem o mundo virtual |

### Consequências

- Integração espacial ↔ operacional é **ponte**, não fusão.
- Remover ou falhar o mapa não pode invalidar o núcleo do produto.
- Evoluir o produto não exige alterar a engine nem o grafo Campus.

Esta regra **não contradiz** a Baseline: a engine permanece genérica; o domínio Lab define dados e pontes.

---

## 5. Navegação (conceitual)

Fluxo oficial de experiência:

```
Opera Campus (infraestrutura compartilhada)
        ↓
  Entrada OperaIA.lab (Residente)
        ↓
  Ambientes da sede (espaço)
        ↓
  Funcionalidades do produto (páginas / operações)
```

### Princípios de navegação

- Chegar ao Lab **sempre** via Campus (grafo canônico Baseline); atalhos temporários de migração não redefine o modelo.
- Dentro da sede, o usuário pode **circular no espaço** e/ou **abrir funcionalidades** — caminhos paralelos válidos.
- Voltar ao Campus é saída da sede, não “fechar o produto”.
- Esta seção **não** define rotas HTTP, componentes Vue nem mudanças de router (fora de escopo deste plano).

---

## 6. Responsabilidades da Sede (exclusivas da OperaIA.lab)

Pertencem **exclusivamente** à OperaIA.lab enquanto Residente operacional da plataforma:

- gestão e presença da **equipe digital** (registry, status, papéis);
- **projetos** e workspaces da plataforma;
- **missões / orquestração** assistida (CEO → delegação → consolidação);
- **reuniões** e alinhamento executivo (conceitual + eventual ponte espacial);
- **inovação / lab** (experimentação e engenharia da plataforma);
- **operações internas** (atividades, fluxos, conhecimento da sede);
- **identidade, cultura e branding** próprios;
- **mapas e atores** da própria sede;
- memória e processos **escopados** ao Lab (quando existirem na persistência futura — Fase 6 do Campus).

---

## 7. O que NÃO pertence à OperaIA.lab

Explicitamente **fora** desta sede:

| Item | Pertence a |
|------|------------|
| Geraí e sua equipe/mapas | Residente Geraí |
| Outras empresas clientes / futuras residentes | Seus próprios contratos |
| Áreas públicas / compartilhadas (Praça, Recepção Principal, etc.) | Opera Campus |
| Infraestrutura de conexão do mundo | Opera Campus |
| Engine genérica | `virtual-world` (congelada na Baseline) |
| Tipologias impostas a outros Residentes | Ninguém — cada um define a sua |

A OperaIA.lab **não** absorve o Campus nem outros Residentes.

---

## 8. Padrão para futuras sedes

Elementos da consolidação Lab que **podem** ser reutilizados por futuros Residentes (opcionalmente):

| Padrão | Reutilizável? | Observação |
|--------|---------------|------------|
| Contrato Residente (mapas, entrada, portais, catálogo) | **Obrigatório** (Baseline) | Única via de integração ao Campus |
| Separação mapa ↔ funcionalidade (§4) | Recomendado | Evita acoplamento sistema↔espaço |
| Navegação Campus → sede → ambientes → funções | Recomendado | Sem impor tipológia de salas |
| Kits / geometria de layout (ex. grade 3×2) | Opcional | Lab não é template obrigatório |
| Padrões visuais / tema | Opcional | Branding é do Residente |
| Employee Framework / missões | Opcional | Só se o Residente for operacional no mesmo sentido |
| Pontes sala → página | Opcional | Contrato de UX, não da engine |

**Regra:** nenhuma sede futura é obrigada a ser uma cópia da OperaIA.lab.  
Reutiliza-se **contratos e padrões**, não a planta.

---

## 9. Critérios de Aceite (da Fase 2 — planejamento)

A Fase 2 estará arquiteturalmente aceita quando o documento (e a alinhamento de produto) responderem com clareza:

| Pergunta | Resposta-síntese |
|----------|------------------|
| Qual o papel da OperaIA.lab? | Residente operacional; sede principal da plataforma; modelo completo de sede |
| Como se relaciona com o Campus? | Entra/sai via grafo; Campus só conecta; Lab não é o mundo |
| Como se relaciona com o produto? | Mapa = espaço; páginas = funções; pontes opcionais; independência mútua (§4) |
| O que pertence à sede? | Equipe, projetos, operações internas, identidade, mapas próprios (§6) |
| O que pertence ao Campus? | Áreas compartilhadas, infraestrutura de conexão, hub da praça |
| O que é reutilizável? | Contratos Baseline + padrões §8 — sem tipológia obrigatória |

Aceite desta **missão de planejamento:** documento aprovado, sem código.

Aceite de **implementação futura** da Fase 2 (após aprovação deste plano): será definido em plano de execução separado, sem alterar a Baseline LOCKED.

---

## 10. Fora do Escopo

Esta fase / este documento **não** implementa e **não** autoriza, por si só:

- novas funcionalidades de produto;  
- novos mapas ou salas;  
- novos funcionários;  
- multiplayer;  
- persistência / autenticação;  
- melhorias visuais;  
- refatorações de Runtime, ECS, Portal System, Providers;  
- alteração do grafo Campus congelado;  
- expansão do Campus ou novos Residentes (Fases 4–5 do roadmap Baseline);  
- consolidação da Geraí (Fase 3).

---

## Decisões arquiteturais (registro)

1. OperaIA.lab = Residente (empresa residente) + sede operacional principal — não o Campus.  
2. Consolidação = integração espacial ↔ operacional, **sem** reconstruir a maquete.  
3. Regra mapa ↔ produto (§4) é **oficial** e permanente enquanto a Baseline vigorar.  
4. Navegação conceitual: Campus → Lab → ambientes → funcionalidades.  
5. Fronteiras Lab vs Campus vs Geraí vs áreas públicas ficam explícitas (§6–§7).  
6. Padrões para outras sedes são **contratos/padrões**, não cópia da planta Lab.  
7. Baseline v1.0 permanece LOCKED; este plano não a altera.

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Confundir “consolidar Lab” com expandir Campus | Escopo §2 e §10; Baseline prevalece |
| Fundir mapa e sistema (quebra §4) | Pontes explícitas; sistema independente do mapa |
| Tratar Lab como template obrigatório de sede | §8 — tipológia livre (Baseline) |
| Implementar “pontes” cedo demais e acoplar rotas à engine | Plano de execução futuro; sem mudar engine |
| Reabrir auditoria `/office` como se fosse Fase 2 | Só após plano de execução aprovado; não neste documento |
| Contradizer Baseline (ex. tipologias “torre”) | Revisão contra Baseline; Baseline vence |

---

## Relação com o roadmap Baseline

| Fase Campus | Relação |
|-------------|---------|
| Fase 1 (feita) | Campus + grafo mínimo |
| **Fase 2 (este plano)** | Consolidação **conceitual/arquitetural** da OperaIA.lab |
| Fase 3 | Consolidação da Geraí |
| Fases 4–7 | Áreas compartilhadas, novos Residentes, persistência, multiplayer |

---

*Documento de planejamento apenas. Nenhuma alteração de código, mapas, rotas, API ou banco está autorizada por este arquivo até aprovação explícita de um plano de execução.*
