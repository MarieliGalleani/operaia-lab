# Adendo Arquitetural — Hub Vertical do Opera Campus

**Tipo:** revisão documental da Baseline (sem implementação)  
**Status:** aguardando aprovação  
**Base:** [`opera-campus-baseline-v1.md`](opera-campus-baseline-v1.md) (v1.0 LOCKED)  
**Efeito após aprovação:** passa a integrar a Baseline como **v1.1** (hub de distribuição)

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
5. Nenhuma implementação foi feita só com este documento.

---

## Próximo passo (após aprovação deste adendo)

1. Atualizar Baseline para **v1.1** (status LOCKED).  
2. Elaborar **plano de execução** mínimo (só mapas/portais/labels do hub) — sem expandir escopo da Fase 2.  
3. Só então implementar.

---

*Documento apenas. Sem alteração de código.*
