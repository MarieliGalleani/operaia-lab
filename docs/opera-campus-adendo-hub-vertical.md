# Adendo Arquitetural — Hub Vertical do Opera Campus

**Tipo:** revisão documental da Baseline  
**Status:** **APROVADO** (Marieli Galleani, 2026-09-07) — integra a Baseline como **v1.1**  
**Base:** [`opera-campus-baseline-v1.md`](opera-campus-baseline-v1.md) (v1.0 LOCKED)  
**Implementação:** ver seção "Registro de implementação" no fim deste documento — divergiu do plano original de "Próximo passo" por limite real de engine, não por decisão de escopo.

---

## Motivação

O produto precisa permitir **ver as duas sedes** (OperaIA.lab e Geraí) com clareza, **sem misturar** equipes, mesas ou processos.

A metáfora aprovada para o hub de distribuição deixa de enfatizar uma “praça aberta” como única forma de apresentação e passa a privilegiar:

> **Hall do Campus + elevador · um Residente por andar**

Isso **não** funde Residentes. Cada andar continua sendo a **sede privada** do Residente (mapa próprio + portais).

---

## Decisão

### Hub canônico (apresentação)

```
Recepção Principal (Campus)
        ↓
Hall / elevador (hub de distribuição)
        ├─ Andar · OperaIA.lab  → mapas do Residente Lab
        └─ Andar · Geraí        → mapas do Residente Geraí
        └─ Andar · futuros Residentes…
```

### O que permanece da Baseline v1.0

| Princípio | Status |
|-----------|--------|
| Campus = infraestrutura, não empresa | Mantido |
| Residentes independentes | Mantido |
| Sem misturar equipes/mesas | Mantido |
| Engine genérica · MapManifest + Portal | Mantido |
| Tipologia não obrigatória para *todas* as sedes | Mantido — o hub vertical é a forma do **Campus hub**, não um template imposto às plantas internas |
| Expansão por composição (mapas + entrada + portais + catálogo) | Mantido |
| Recepção apenas recebe; distribuição no hub | Mantido (hub = hall/elevador) |

### O que este adendo altera (só conceito de navegação)

| Antes (v1.0) | Depois (proposta v1.1) |
|--------------|-------------------------|
| Praça Central como hub visual principal | **Hall + elevador** como hub visual principal |
| Fachadas na praça | **Andares / portas de elevador** = entradas de Residentes |
| `campus-plaza` como nome conceitual do hub | Hub = **distribuição vertical**; o mapa atual `campus-plaza` pode ser **reinterpretado** ou evoluído nessa direção **somente após plano de execução aprovado** |

### O que este adendo NÃO autoriza

- Misturar OperaIA.lab e Geraí no mesmo andar / mesma planta operacional  
- Colocar Geraí “dentro” do Lab ou o contrário  
- Fundir atores, memória ou processos  
- Alterar Runtime, ECS, Portal System ou engine  
- Implementação imediata (código, mapas, portais) sem plano de execução aprovado  
- Invalidar a Fase 2 (consolidação Lab) — são eixos distintos

---

## Modelo de isolamento

| Camada | Conteúdo |
|--------|----------|
| Hall / elevador | Infraestrutura Campus — só escolhe o Residente |
| Andar OperaIA.lab | Mapas + equipe + produto Lab |
| Andar Geraí | Mapas + equipe Geraí |
| Futuro andar N | Novo Residente via registro (sem editar andares existentes) |

Regra de ouro (inalterada):

> Ver as duas sedes ≠ misturar as duas sedes.

---

## Relação com documentos existentes

| Documento | Impacto |
|-----------|---------|
| Baseline v1.0 | Adendo; após aprovação → Baseline **v1.1** com hub vertical |
| Fase 1 (`opera-campus-fase-1.md`) | Praça permanece como entrega histórica; hub canônico evolui para hall/elevador |
| Fase 2 (`operaia-lab-fase-2.md`) | Continua válida (mapa ↔ produto); Lab continua Residente no seu andar |
| Extensão de Residentes | Continua: registrar mapas + entrada (andar) + portais + catálogo |

---

## Critérios de aceite deste adendo (documental)

1. Hall + elevador é o **hub de distribuição** do Campus.  
2. Cada Residente ocupa **andar(es) próprio(s)** — mapas separados.  
3. Não há mistura de equipes entre andares.  
4. Novos Residentes = novos andares/entradas por composição.  
5. ~~Nenhuma implementação foi feita só com este documento.~~ Superado — ver "Registro de implementação" abaixo.

---

## Registro de implementação (2026-09-07)

O plano original de "Próximo passo" (Baseline v1.1 → plano de execução →
só então implementar) foi comprimido: a aprovação e a implementação
pragmática aconteceram na mesma sessão, a pedido da Marieli ("pode
fazer") depois de constatar dois problemas concretos que tornavam a
navegação confusa — Geraí sem entrada registrada na praça (Residente
documentado, impossível de visitar) e nenhum atalho pra chegar direto
num Residente sem caminhar até a fachada certa.

**O que foi construído é uma leitura pragmática do hub vertical, não
um elevador físico:**

- Um painel de UI ("Elevador · escolha o andar") abre automaticamente
  ao chegar na Recepção, listando todos os Residentes registrados
  (`campus-resident-entrances.ts`) com teleporte direto de um clique.
- **Motivo de não ter sido um elevador espacial de verdade:** o Portal
  System da engine troca de mapa sozinho ao ser tocado (1 portal = 1
  destino fixo) — não existe hoje um tipo de interação multi-destino
  ("entra na cabine, escolhe o andar, sai no andar certo"). Construir
  isso exigiria alterar o Portal System/Runtime, o que este próprio
  adendo proíbe explicitamente ("O que este adendo NÃO autoriza").
- A Praça Central **não foi alterada nem removida** — continua
  navegável a pé, exatamente como a v1.0 previa. O painel é aditivo.
- Geraí foi registrada no catálogo do mundo (`office-map-provider.ts`)
  e na praça (`campus-resident-entrances.ts`) — antes tinha mapas e
  elenco prontos mas nenhum registro, portanto inacessível.

**Ainda em aberto, se algum dia fizer sentido priorizar:** um elevador
espacial de verdade (cabine, animação, escolha de andar dentro do
próprio mundo 3D) continua sendo trabalho de engine genuíno, não
coberto por este adendo nem pela implementação atual.

---

*Decisão registrada; implementação descrita acima já em produção.*
