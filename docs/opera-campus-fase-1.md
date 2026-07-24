# Plano Oficial — Fase 1 · Opera Campus (MVP espacial)

**Status:** oficial · Baseline Arquitetural Opera Campus v1.0  
**Objetivo:** infraestrutura permanente do mundo virtual + navegação mínima Campus ↔ Residentes  
**Adendo pendente:** ver [`opera-campus-adendo-hub-vertical.md`](opera-campus-adendo-hub-vertical.md) (hall + elevador · um Residente por andar)

## Ajustes incorporados (pré-implementação)

1. O **Opera Campus** é o ponto de entrada do mundo virtual. A arquitetura descreve o **grafo de mapas**, não uma rota HTTP específica.
2. A **Praça Central** é um **hub dinâmico**, preparado para qualquer quantidade de Residentes.
3. A **Recepção Principal** apenas recebe o usuário; a distribuição para Residentes ocorre **exclusivamente** pela Praça Central.
4. **Aceite:** um novo Residente integra-se registrando mapas, entrada e portais — **sem modificar mapas já existentes**.
5. Cada Residente é responsável apenas pelos seus mapas; o Campus atua só como **infraestrutura de conexão**.

## Princípio operacional (extensão)

- Extensão de Residentes na praça: registro de entradas (`campus-resident-entrances`), não edição da geometria da praça.
- Engine `virtual-world` permanece genérica.

## Mapas

| ID | Ação | Papel |
|----|------|--------|
| `campus-reception` | criar | Chegada; só liga à praça |
| `campus-plaza` | criar | Hub dinâmico de Residentes |
| `gerai-entrance` | criar | Entrada oficial Geraí |
| `office` | reutilizar | Sede OperaIA.lab |
| `gerai-f2` | reutilizar | Interior Geraí (atual) |

## Grafo canônico

```
campus-reception ↔ campus-plaza
                      ├─→ office (OperaIA.lab) ↔ praça
                      └─→ gerai-entrance ↔ gerai-f2
Atalho temporário: office ↔ gerai-f2
```

## Sequência de implementação

0. Catálogo / IDs / actors  
1. Recepção  
2. Praça (hub)  
3. Integrar Lab  
4. Entrada Geraí  
5. Entrypoint do mundo = Campus  
6. Testes e aceite  

## Fora de escopo

Auth, persistência multiempresa, novos funcionários/salas, correções de auditoria `/office`, refatoração de Runtime, polish visual não essencial.
