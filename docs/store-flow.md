# Store Flow — 1º andar da sede (marketing de afiliados)

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
| **Driele** | Escritora | Redação | Escreve um texto por produto e por canal (Instagram, WhatsApp, Telegram, roteiro de TikTok) com o LLM, passando por guardrails. |

## Fluxo

```text
CSV do portal ──► Flow (curadoria) ──► Driele (textos) ──► fila PENDING_APPROVAL ──► você aprova e publica
```

Nada é publicado automaticamente. Todo rascunho nasce `PENDING_APPROVAL`, e
`reviewDraft` não deixa aprovar um texto sem o aviso de link de afiliado.

## Táticas de vendedor

- **Produto em alta (Flow):** com `vendidos_30d` no CSV, a Flow marca o que está vendendo agora; com
  `preco_original`, marca desconto real. Sinais: em alta, com desconto, campeão de vendas, loja top.
- **Variedade (Flow):** no máximo 2 produtos da mesma categoria por rodada (`maxPerCategory`).
- **Ângulo certo (Driele):** o sinal decide como abrir o texto — em alta, oferta, prova social,
  problema → solução ou curiosidade. Gancho de até 8 palavras, um benefício concreto, chamada clara.
- **Teste A/B:** cada post sai em duas versões (ângulos e horários diferentes), cada uma com seu
  `subId` (`campanha-produto-canal-A|B`) para o relatório do portal separar o que vendeu.
- **Horários de partida (Brasília):** Instagram 12:00/19:30 · WhatsApp 12:00/20:00 ·
  Telegram 09:00/20:00 · TikTok 19:00/21:30. São hipóteses para o primeiro teste.
- **Aprender:** com o relatório do portal (CSV `sub_id, cliques, pedidos, comissao`):

```bash
pnpm --filter @operaia/store-flow aprender -- rodada.json relatorio.csv --saida aprendizado.json
pnpm --filter @operaia/store-flow run:csv -- produtos.csv --nicho "..." --canais instagram --aprendizado aprendizado.json
```

  O vencedor só é declarado com pelo menos 30 cliques por grupo. O ângulo que mais rendeu por
  clique vira a versão A da próxima rodada, e os horários vencedores substituem os de partida.

## Guardrails da Driele

- Proibido: garantia, "100%", "melhor preço", "últimas unidades", "só hoje", promessas de saúde.
- Qualquer valor em R$ precisa ser o preço real do produto.
- Link e aviso de afiliado sempre no texto; limite de caracteres por canal.
- Se o LLM falhar ou quebrar uma regra, a Driele usa um template seguro (`source: "template"`).

## Critérios padrão da Flow

Nota ≥ 4,5 · loja ≥ 4,5 · ≥ 50 vendidos · comissão ≥ 5% · top 5 por rodada.
Pontuação 0–100: comissão em R$ (35) + nota (20) + vendas (15) + em alta (12) + loja (10) + desconto (8).
Tudo configurável em `StoreFlowConfig`.

## Como rodar hoje

```bash
pnpm --filter @operaia/store-flow run:csv -- examples/produtos-exemplo.csv \
  --nicho "casa e organizacao" --canais instagram,whatsapp \
  --categorias casa,cozinha --max 5 --tom "leve e divertido" --saida rodada.json
```

- Usa `LLM_PROVIDER` / `GEMINI_API_KEY` do `.env`. Sem isso, cai no modo
  `deterministic` e a Driele escreve pelo template.
- Colunas do CSV (pt ou en): `id, titulo, link, preco, comissao, nota, vendidos, categoria`;
  opcionais: `nota_loja, vendidos_30d, preco_original`.
  Aceita `;` ou `,`, `R$ 1.299,90` e `12%`.

## Painel do andar (dashboard)

Menu **Equipe › Store Flow** → `/app/store-flow`. Usa a mesma rodada da Sala de
Aprovação (carregar em qualquer uma das duas telas vale para as duas).

- Equipe: o que a Flow e a Driele fizeram nesta rodada.
- Números: potencial de comissão (1 venda de cada), já liberado, posts aguardando, taxa de aproveitamento.
- Gráficos: melhores oportunidades (nota da Flow), caminho da rodada (analisados → aprovados),
  posts por canal (aprovado/pendente/recusado, com ícone e legenda) e por que a Flow deixou produtos de fora.
- Cada gráfico tem **Ver tabela** e dica ao passar o mouse ou navegar pelo teclado.

## Sala de Aprovação (tela)

Menu **Equipe › Store Flow** → `/app/store-flow/aprovacao`.

1. Clique em **Carregar rodada** e escolha o `.json` gerado pelo `run:csv`.
2. Cada card mostra o produto, a nota da Flow, a comissão estimada e os motivos da escolha.
3. Edite o texto se quiser e clique em **Aprovar** ou **Recusar** (dá para voltar para pendente).
4. **Baixar aprovados** gera `store-flow-aprovados.json` só com o que pode ser publicado.

Regras da tela (as mesmas do pacote): não aprova sem o aviso de afiliado.
Quando o link ainda está sem rastreio, é preciso trocar a URL do produto pelo
seu link de afiliado no texto antes de aprovar — o link colado vira o oficial.
A fila fica salva neste navegador até você clicar em **Limpar fila**.

## No escritório

Elevador na recepção da sede → `store-flow` (nível 1, que era o reservado).
Salas: Recepção · Radar de Ofertas · Sala de Aprovação · Redação · Estúdio de Vídeo · Lounge.

## Próximos passos

1. Plugar a API oficial de afiliados num novo `AffiliateLinkProvider` (links rastreados automáticos).
2. Carregar a rodada direto da API (sem arquivo) e salvar decisões no banco.
3. Agendamento da rodada e publicação só dos aprovados, nos canais declarados no cadastro.
