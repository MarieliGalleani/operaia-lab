import { describe, expect, it } from "vitest";
import { parseDate, parseMoney, parseSalesCsv, splitLine } from "./business-csv.js";

describe("parseMoney", () => {
  it.each([
    ["R$ 1.234,56", 1234.56],
    ["1234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1234.56", 1234.56],
    ["1.234", 1234],
    ["12.5", 12.5],
    ["  350 ", 350],
    ["(100,00)", -100],
    ["-50", -50],
  ])("%s -> %s", (raw, expected) => {
    expect(parseMoney(raw)).toBe(expected);
  });

  it.each(["", "abc", "1,2,3", "1.2.3,4.5"])("recusa %j", (raw) => {
    expect(parseMoney(raw)).toBeNull();
  });
});

describe("parseDate", () => {
  it.each([
    ["2026-03-05", "2026-03-05"],
    ["05/03/2026", "2026-03-05"],
    ["5/3/26", "2026-03-05"],
    ["05-03-2026", "2026-03-05"],
    ["2026-03-05T10:20:00", "2026-03-05"],
    ["05/03/2026 14:30", "2026-03-05"],
  ])("%s -> %s", (raw, expected) => {
    expect(parseDate(raw)).toBe(expected);
  });

  it.each(["31/02/2026", "2026-13-01", "ontem", "", "1/1/1800"])("recusa %j", (raw) => {
    expect(parseDate(raw)).toBeNull();
  });
});

describe("splitLine", () => {
  it("respeita aspas e aspas escapadas", () => {
    expect(splitLine('a;"b;c";"d ""x"""', ";")).toEqual(["a", "b;c", 'd "x"']);
  });
});

describe("parseSalesCsv", () => {
  it("lê planilha brasileira com ; e cabeçalho em português", () => {
    const csv = [
      "Data;Cliente;Produto;Valor;Custo",
      '05/03/2026;Mercado Sol;Arroz 5kg;"R$ 1.250,00";900,00',
      "06/03/2026;Padaria Lua;Farinha;300;180",
    ].join("\n");
    const r = parseSalesCsv(csv);
    expect(r.fatal).toBeNull();
    expect(r.hasCost).toBe(true);
    expect(r.rejected).toEqual([]);
    expect(r.sales).toHaveLength(2);
    expect(r.sales[0]).toMatchObject({
      date: "2026-03-05",
      customer: "Mercado Sol",
      product: "Arroz 5kg",
      revenue: 1250,
      cost: 900,
      lineNumber: 2,
    });
  });

  it("lê planilha em inglês com vírgula (formato do nexo)", () => {
    const r = parseSalesCsv("date,customer,product,revenue,cost\n2026-01-10,Acme,Widget,100.5,40\n");
    expect(r.fatal).toBeNull();
    expect(r.sales[0]).toMatchObject({ date: "2026-01-10", revenue: 100.5, cost: 40 });
  });

  it("aceita planilha sem custo e marca hasCost=false", () => {
    const r = parseSalesCsv("data;cliente;produto;valor\n01/02/2026;A;B;10");
    expect(r.hasCost).toBe(false);
    expect(r.sales[0]?.cost).toBeNull();
  });

  it("explica quais colunas faltam", () => {
    const r = parseSalesCsv("data;produto;valor\n01/02/2026;B;10");
    expect(r.fatal).toMatch(/cliente/);
  });

  it("recusa linha ruim com número da linha e motivo, sem perder as boas", () => {
    const r = parseSalesCsv(
      ["data;cliente;produto;valor;custo", "01/02/2026;A;B;10;5", "99/99/2026;A;B;10;5", "02/02/2026;;B;10;5", "03/02/2026;A;B;dez;5"].join("\n"),
    );
    expect(r.sales).toHaveLength(1);
    expect(r.rejected.map((x) => x.lineNumber)).toEqual([3, 4, 5]);
    expect(r.rejected[0]?.reason).toMatch(/Data inválida/);
  });

  it("planilha vazia ou só com cabeçalho dá erro claro", () => {
    expect(parseSalesCsv("").fatal).toMatch(/vazia/);
    expect(parseSalesCsv("data;cliente;produto;valor\n").fatal).toMatch(/cabeçalho/);
  });

  it("duas vendas idênticas no mesmo dia viram chaves diferentes; reenviar a mesma planilha repete as chaves", () => {
    const csv = "data;cliente;produto;valor\n01/02/2026;A;B;10\n01/02/2026;A;B;10";
    const first = parseSalesCsv(csv);
    const again = parseSalesCsv(csv);
    expect(first.sales).toHaveLength(2);
    expect(first.sales[0]?.dedupKey).not.toBe(first.sales[1]?.dedupKey);
    expect(again.sales.map((s) => s.dedupKey)).toEqual(first.sales.map((s) => s.dedupKey));
  });

  it("ignora BOM e linhas em branco", () => {
    const r = parseSalesCsv("﻿data;cliente;produto;valor\r\n\r\n01/02/2026;A;B;10\r\n");
    expect(r.fatal).toBeNull();
    expect(r.sales).toHaveLength(1);
  });
});
