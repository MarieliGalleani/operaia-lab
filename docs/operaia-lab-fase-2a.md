# OperaIA.lab — Fase 2A · Plano Técnico (Integração Espacial ↔ Produto)

**Tipo:** arquitetura e planejamento · **sem implementação**  
**Status:** aguardando aprovação  
**Referências (prevalecem em conflito):**  
- [`opera-campus-baseline-v1.md`](opera-campus-baseline-v1.md) (LOCKED)  
- [`operaia-lab-fase-2.md`](operaia-lab-fase-2.md) (Plano Técnico Fase 2)  

**Escopo desta fase:** apenas **definir** como o mapa da OperaIA.lab se integra às **funcionalidades já existentes**.  
**Não** expande o Campus · **não** adiciona funcionalidades · **não** modifica a arquitetura congelada.

---

## 1. Do espaço físico para a funcionalidade

Fluxo conceitual oficial:

```
Usuário (no mapa da sede OperaIA.lab)
        ↓
Ambiente / sala (localização espacial)
        ↓
Abrir funcionalidade (ponte opcional)
        ↓
Página de produto correspondente
```

### Exemplo canônico

```
Usuário → Sala CEO (mapa) → Página Sala da CEO (/office/sala-ceo)
```

### Regras deste sentido

- A abertura é **intencional** (o usuário escolhe entrar na operação).
- O mapa **indica contexto** (onde estou); a página **executa** a operação.
- Se a ponte não existir ou falhar, o mapa e a página continuam utilizáveis **em separado** (via navegação de produto já existente).

---

## 2. Da funcionalidade de volta ao espaço físico

Fluxo conceitual oficial:

```
Página de produto
        ↓
Retornar ao espaço (ponte opcional)
        ↓
Mapa da OperaIA.lab
        ↓
Ambiente de origem (quando conhecido) ou spawn padrão da sede
```

### Exemplo canônico

```
Página Sala da CEO → Mapa office → Sala CEO (posição / spawn de ambiente)
```

### Regras deste sentido

- O retorno **não** é obrigatório para usar a página.
- Se não houver “ambiente de origem” memorizado, retorna-se ao **spawn padrão da sede** (já existente no mapa).
- A página **não** precisa do runtime espacial para funcionar; o retorno só faz sentido quando o mundo estiver disponível.

---

## 3. Ambientes × funcionalidades existentes

Somente funcionalidades **já existentes** no produto. **Não** criar novas áreas no mapa.

| Ambiente espacial (maquete atual / conceito) | Funcionalidade existente | Ponte sugerida (conceitual) |
|---------------------------------------------|--------------------------|-----------------------------|
| Sala CEO / Direção | Sala da CEO | Ambiente → página CEO; retorno → Sala CEO |
| Espaço de Trabalho / presença da equipe | Equipe | Ambiente → página Equipe; retorno → workspace |
| (sem tile obrigatório) | Projetos | Página acessível sem mapa; retorno opcional → sede |
| (sem tile por projeto na maquete atual) | Workspace (`/office/projetos/:id`) | Página sem mapa dedicado; retorno → sede ou Equipe |
| Lounge / circulação / sede em geral | Central de atividades | Página sem tile obrigatório; retorno → sede |
| — | Conhecimento | Página standalone; retorno → sede |
| — | Configurações | Página standalone; retorno → sede |
| Recepção Lab | (chegada / saída Campus) | Navegação espacial Campus ↔ Lab; **não** é página de operação |

### Notas

- Ambientes **sem** página dedicada (ex.: Lab IA, Reunião, Lounge) permanecem só espaciais nesta fase — **sem** inventar funcionalidades.
- Projetos / Workspace / Atividades / Conhecimento / Configurações **já existem** como páginas; a Fase 2A só define se e como o mapa **pode** abri-las, sem exigir tile 1:1.

---

## 4. Regra oficial de integração

| Regra | Enunciado |
|-------|-----------|
| Localização | O **mapa** representa localização (presença, lugar, circulação). |
| Operação | A **página** representa operação (dados, edição, workflows). |
| Não substituição | O mapa **nunca** substitui a página. |
| Não dependência | A página **nunca** depende do mapa. |
| Opcionalidade | **Toda** integração (ponte) é **opcional**. |

Herdado e detalhado da Fase 2 §4. Esta é a regra oficial da Fase 2A.

---

## 5. Navegação (conceitual)

```
Campus
  ↓
OperaIA.lab (mapa da sede)
  ↓
Ambiente (sala / zona)
  ↓
Página (funcionalidade existente)
  ↓
Retorno ao ambiente (ou spawn padrão da sede)
```

- Entrada no Lab via grafo Campus (Baseline).  
- Circulação interna = espacial.  
- Operação = páginas.  
- Retorno = ponte opcional espaço ← produto.  
- **Sem** definir rotas, componentes ou eventos neste documento.

---

## 6. Responsabilidades

### Mapa (espaço)

- presença  
- localização  
- navegação espacial (tiles, portais da sede)  
- ambientação  

### Página (produto)

- edição  
- operações  
- dados  
- workflows  

### Ponte (integração — conceitual)

- traduzir “estou neste ambiente” → “abrir esta funcionalidade”  
- traduzir “fechar / voltar” → “recolocar no ambiente”  
- **não** carrega regras de negócio nem substitui API/Employee Framework  

---

## 7. Contratos conceituais

Sem componentes, APIs ou código — apenas contratos de produto:

### Contrato A — Abrir funcionalidade

```
Ambiente (id conceitual)
  → intenção: AbrirFuncionalidade
  → alvo: FuncionalidadeExistente (ex.: CEO, Equipe, Projetos…)
  → resultado: usuário na Página correspondente
```

### Contrato B — Retornar ao ambiente

```
Página
  → intenção: RetornarAoAmbiente
  → alvo: AmbienteDeOrigem | SpawnPadrãoDaSede
  → resultado: usuário no Mapa da OperaIA.lab na posição adequada
```

### Contrato C — Independência

```
Mapa opera sem Páginas.
Páginas operam sem Mapa.
Pontes existem só quando ambos estão disponíveis e o usuário as aciona.
```

### Contrato D — Reuso por futuras sedes

```
Mesmos contratos A/B/C.
Cada Residente mapeia seus Ambientes → suas Funcionalidades.
Nenhuma sede é obrigada a copiar a planta nem o conjunto de páginas do Lab.
```

---

## 8. Critérios de aceite (deste plano)

O documento responde:

| Pergunta | Resposta |
|----------|----------|
| Como um ambiente abre uma página? | Contrato A — intenção opcional Ambiente → FuncionalidadeExistente → Página |
| Como uma página retorna ao ambiente? | Contrato B — RetornarAoAmbiente → origem ou spawn padrão |
| Como preservar independência mapa ↔ sistema? | Regra §4 + Contrato C |
| Como futuras sedes reutilizam o padrão? | Contrato D — mesmos contratos, mapeamentos próprios |

Aceite desta **missão:** documento aprovado, **zero** código.

Aceite de **execução** da Fase 2A: somente após aprovação explícita de um plano de implementação derivado deste documento.

---

## 9. Fora do escopo

Esta fase / este documento **não** autoriza:

- implementar qualquer coisa;  
- alterar mapas / criar salas / criar bridge / criar eventos / criar componentes;  
- criar novos fluxos de produto;  
- alterar rotas, Runtime, ECS, World Runtime, Portal System, Providers;  
- alterar API ou banco;  
- expandir Campus ou outros Residentes;  
- novas funcionalidades além das já listadas no §3.

---

## Decisões arquiteturais (registro)

1. Fase 2A = **só** integração espacial ↔ funcionalidades **existentes**.  
2. Sentido Ambiente → Página e Página → Ambiente são **opcionais** e simétricos em intenção.  
3. Regra mapa = localização / página = operação é **oficial**.  
4. Matriz §3 limita pontes ao que o produto já oferece — sem novas áreas.  
5. Contratos A–D são o padrão reutilizável para outras sedes.  
6. Baseline v1.0 e Fase 2 permanecem válidos; este doc apenas detalha a integração Lab.

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Implementar bridge cedo e acoplar página ao ECS | Contratos C + fora de escopo; execução só após aprovação |
| Exigir tile para toda página (Projetos, Config…) | §3 — páginas podem ser standalone |
| Usar integração para “consertar” auditoria `/office` inteira | Escopo só pontes Lab; resto fora |
| Contradizer Baseline (misturar Residentes, logic na engine) | Pontes no domínio/produto; engine intocada |
| Confundir 2A com hub vertical (adendo Campus) | 2A = Lab interno; hub Campus é documento separado |

---

## Relação com fases

| Documento | Papel |
|-----------|--------|
| Baseline v1.0 | Mundo / Campus LOCKED |
| Fase 2 | Papel da sede Lab + regra mapa↔produto |
| **Fase 2A (este)** | Detalhe das pontes Lab ↔ páginas existentes |
| Execução futura | Implementação mínima das pontes — plano à parte |

---

*Planejamento apenas. Nenhuma alteração de código está autorizada por este arquivo.*
