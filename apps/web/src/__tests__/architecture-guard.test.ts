import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * GUARDA DE ARQUITETURA — OperaIA 2.0 (Plataforma de Mundo Virtual).
 *
 * Regra obrigatoria:
 *   `modules/virtual-world` (engine generica) NAO pode importar NADA de
 *   `modules/office-domain` (dados/negocio do escritorio).
 *
 * A dependencia so pode fluir em UM sentido: office-domain -> virtual-world.
 * Este teste roda na suite (portanto no CI) e falha se houver import proibido.
 * Ver: docs/architecture-guard.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = join(HERE, "..", "modules");
const VIRTUAL_WORLD_DIR = join(MODULES_DIR, "virtual-world");
const OFFICE_DOMAIN_DIR = join(MODULES_DIR, "office-domain");

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".vue", ".mts", ".cts"] as const;
const FORBIDDEN_TOKEN = "office-domain";

/** Coleta recursivamente arquivos de codigo-fonte de um diretorio. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.some((ext) => full.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Extrai os especificadores de modulo de um arquivo (apenas imports/exports
 * reais). Comentarios e strings soltas sao ignorados de proposito.
 */
function extractModuleSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  const patterns: readonly RegExp[] = [
    // import ... from "x" / export ... from "x"
    /\b(?:import|export)\b[^;'"\n]*?\bfrom\s*['"]([^'"]+)['"]/g,
    // import "x" (efeito colateral)
    /\bimport\s*['"]([^'"]+)['"]/g,
    // import("x") (dinamico)
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // require("x")
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        specifiers.push(match[1]);
      }
    }
  }
  return specifiers;
}

function findForbiddenImports(rootDir: string, token: string): string[] {
  const violations: string[] = [];
  for (const file of collectSourceFiles(rootDir)) {
    const content = readFileSync(file, "utf8");
    for (const specifier of extractModuleSpecifiers(content)) {
      if (specifier.includes(token)) {
        violations.push(`${relative(MODULES_DIR, file)}  ->  "${specifier}"`);
      }
    }
  }
  return violations;
}

describe("Guarda de arquitetura: virtual-world nao depende de office-domain", () => {
  it("nao existe nenhum import de office-domain dentro de virtual-world", () => {
    const violations = findForbiddenImports(VIRTUAL_WORLD_DIR, FORBIDDEN_TOKEN);
    expect(
      violations,
      violations.length > 0
        ? `Import proibido: a engine 'virtual-world' importou 'office-domain'.\n` +
            `A engine deve permanecer generica. Mova o dado/regra para office-domain\n` +
            `ou injete-o via provider.\nOcorrencias:\n - ${violations.join("\n - ")}`
        : undefined,
    ).toEqual([]);
  });

  it("a extracao de imports ignora comentarios (nao gera falso-positivo)", () => {
    const sample = [
      "// veja office-domain para detalhes",
      "/* office-domain e apenas dado */",
      'import { A } from "../virtual-world/contracts/map";',
    ].join("\n");
    expect(extractModuleSpecifiers(sample)).toEqual(["../virtual-world/contracts/map"]);
  });

  it("detecta corretamente um import proibido (sanidade da guarda)", () => {
    const bad = 'import { OFFICE_MAP } from "../office-domain/data/office-map";';
    const specifiers = extractModuleSpecifiers(bad);
    expect(specifiers.some((s) => s.includes(FORBIDDEN_TOKEN))).toBe(true);
  });

  it("o sentido permitido (office-domain -> virtual-world) existe e e valido", () => {
    const specifiers = collectSourceFiles(OFFICE_DOMAIN_DIR).flatMap((file) =>
      extractModuleSpecifiers(readFileSync(file, "utf8")),
    );
    expect(specifiers.some((s) => s.includes("virtual-world"))).toBe(true);
  });
});
