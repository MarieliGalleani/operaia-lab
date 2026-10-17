# Flow Story — 1º andar da sede (marketing de afiliados)

Andar separado do escritório virtual, com elenco próprio. Copiado do molde do
Mercúrio (Marketing) e do 2º andar da Geraí. **Não** entra no roster da Equipe
Digital nem na delegação do CEO: roda o próprio pipeline.

O andar não cita nenhum marketplace pelo nome. Os produtos chegam como dado
(CSV exportado do portal de afiliados) e o link rastreado passa por uma porta
trocável (`AffiliateLinkProvider`).

## Elenco

| Agente | Cargo | Sala | O que faz |
|---|---|---|---|
| **Flow** | Robô de Ofertas | Radar de Ofertas | Filtra e pontua produtos (nota, loja, vendas, comissão, nicho), explica cada escolha e cada recusa, gera o link de afiliado. Determinístico: não usa LLM, não inventa número. |
| **Story** | Escritora | Redação | Escreve um texto por produto e por canal (Instagram, WhatsApp, Telegram, roteiro de TikTok) com o LLM, passando por guardrails. |

## Fluxo

```text
CSV do portal ──► Flow (curadoria) ──► Story (textos) ──► fila PENDING_APPROVAL ──► você aprova e publica
```

Nada é publicado automaticamente. Todo rascunho nasce `PENDING_APPROVAL`, e
`reviewDraft` não deixa aprovar um texto sem o aviso de link de afiliado.

## Guardrails da Story

- Proibido: garantia, "100%", "melhor preço", "últimas unidades", "só hoje", promessas de saúde.
- Qualquer valor em R$ precisa ser o preço real do produto.
- Link e aviso de afiliado sempre no texto; limite de caracteres por canal.
- Se o LLM falhar ou quebrar uma regra, a Story usa um template seguro (`source: "template"`).

## Critérios padrão da Flow

Nota ≥ 4,5 · loja ≥ 4,5 · ≥ 50 vendidos · comissão ≥ 5% · top 5 por rodada.
Pontuação 0–100: comissão em R$ (40) + nota (25) + vendas (20) + loja (15).
Tudo configurável em `FlowStoryConfig`.

## Como rodar hoje

```bash
pnpm --filter @operaia/flow-story run:csv -- examples/produtos-exemplo.csv \
  --nicho "casa e organizacao" --canais instagram,whatsapp \
  --categorias casa,cozinha --max 5 --tom "leve e divertido" --saida rodada.json
```

- Usa `LLM_PROVIDER` / `GEMINI_API_KEY` do `.env`. Sem isso, cai no modo
  `deterministic` e a Story escreve pelo template.
- Colunas do CSV (pt ou en): `id, titulo, link, preco, comissao, nota, vendidos, categoria, nota_loja`.
  Aceita `;` ou `,`, `R$ 1.299,90` e `12%`.

## No escritório

Elevador na recepção da sede → `flow-story` (nível 1, que era o reservado).
Salas: Recepção · Radar de Ofertas · Sala de Aprovação · Redação · Estúdio de Vídeo · Lounge.

## Próximos passos

1. Plugar a API oficial de afiliados num novo `AffiliateLinkProvider` (links rastreados automáticos).
2. Tela de aprovação na Sala de Aprovação (lista de rascunhos com aprovar/editar/recusar).
3. Agendamento da rodada e publicação só dos aprovados, nos canais declarados no cadastro.
