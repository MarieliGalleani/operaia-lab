# Guarda de Arquitetura — Mundo Virtual × Domínio

## Regra

A arquitetura OperaIA 2.0 tem dois módulos com um **sentido único** de dependência:

```
office-domain  ──importa──▶  virtual-world      (PERMITIDO)
virtual-world  ──importa──▶  office-domain      (PROIBIDO)
```

- **`modules/virtual-world/`** — engine genérica (Map, Entity, Area, Layer, Tile,
  Portal, Camera, Interaction, Event, State). **Não conhece nenhum conceito de
  negócio.**
- **`modules/office-domain/`** — dados específicos do escritório (mapas, temas,
  atores, regras). Consome a engine implementando suas portas (providers).

> **A engine nunca pode importar nada de `office-domain`.** Qualquer dado ou
> regra de negócio entra na engine apenas por **injeção via provider**
> (`WorldDataProvider`), nunca por `import`.

## Como é validada

Um teste automatizado varre recursivamente todos os arquivos-fonte
(`.ts`/`.tsx`/`.vue`/`.mts`/`.cts`) de `modules/virtual-world`, extrai os
`import`/`export … from`/`import()`/`require()` **reais** (comentários são
ignorados) e falha se algum especificador referenciar `office-domain`.

- Teste: `apps/web/src/__tests__/architecture-guard.test.ts`
- Executa na suíte padrão (CI): `pnpm test` → `pnpm -r test`
- Execução isolada: `pnpm --filter @operaia/web test:arch`

Se a barreira falhar, a mensagem lista cada arquivo e o import proibido. Para
corrigir: mova o dado/regra para `office-domain` **ou** injete-o por um provider,
mantendo a engine genérica.
