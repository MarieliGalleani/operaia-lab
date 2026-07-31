/**
 * Matriz configuravel de delegacao — unica fonte de regras path→especialista.
 * Evita regras espalhadas pelo codigo.
 */
import { Specialization } from "@operaia/employee-framework";

export interface DelegationMatrixRule {
  readonly id: string;
  /** Glob simples: `apps/api/**`, `*.ts`, `docker-compose*`, `README`. */
  readonly patterns: readonly string[];
  readonly specializations: readonly Specialization[];
  /** Se true, o path e ignorado (salvo quando outros paths tecnicos existem). */
  readonly ignore?: boolean;
}

/** Matriz oficial OperaIA.lab. */
export const DEFAULT_DELEGATION_MATRIX: readonly DelegationMatrixRule[] = [
  {
    id: "docs-readme",
    patterns: ["README", "README.*", "docs/**", "doc/**"],
    specializations: [],
    ignore: true,
  },
  {
    id: "backend-api-packages",
    patterns: ["apps/api/**", "packages/**", "*.ts", "*.tsx"],
    specializations: [Specialization.SOFTWARE_ENGINEERING],
  },
  {
    id: "frontend-web",
    patterns: ["apps/web/**", "*.vue", "*.css", "*.scss"],
    // Luna + Mag (impacto tecnico no frontend)
    specializations: [
      Specialization.PRODUCT_DESIGN,
      Specialization.SOFTWARE_ENGINEERING,
    ],
  },
  {
    id: "infra",
    patterns: [
      "infra/**",
      "Dockerfile",
      "Dockerfile.*",
      "docker-compose*",
      "*.yaml",
      "*.yml",
    ],
    specializations: [Specialization.AUTOMATION],
  },
  {
    id: "legal",
    patterns: ["legal/**", "contracts/**", "privacy/**"],
    specializations: [Specialization.LEGAL],
  },
  {
    id: "marketing",
    patterns: ["marketing/**", "landing/**"],
    specializations: [Specialization.MARKETING],
  },
  {
    id: "finance",
    patterns: ["finance/**", "billing/**"],
    specializations: [Specialization.FINANCE],
  },
  {
    id: "product",
    patterns: ["product/**", "roadmap/**"],
    specializations: [Specialization.PRODUCT_MANAGEMENT],
  },
  {
    id: "operations",
    patterns: ["operations/**"],
    specializations: [Specialization.OPERATIONS],
  },
  {
    id: "migrations",
    patterns: ["**/migrations/**", "prisma/migrations/**"],
    specializations: [Specialization.SOFTWARE_ENGINEERING],
  },
  {
    id: "package-json",
    patterns: ["package.json", "**/package.json"],
    specializations: [Specialization.SOFTWARE_ENGINEERING],
  },
];

/**
 * Match de glob simples (sem dependencia externa).
 * Suporta: `**`, `*`, prefixo de pasta, basename README.
 */
export function matchDelegationPattern(
  path: string,
  pattern: string,
): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  const lowerPath = normalized.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  if (lowerPattern === "readme") {
    const base = lowerPath.split("/").pop() ?? lowerPath;
    return /^readme(\.[a-z0-9]+)?$/.test(base);
  }

  if (lowerPattern.startsWith("readme.")) {
    const base = lowerPath.split("/").pop() ?? lowerPath;
    return base === lowerPattern || base.startsWith("readme.");
  }

  // Extensao: *.ts
  if (lowerPattern.startsWith("*.")) {
    const ext = lowerPattern.slice(1);
    return lowerPath.endsWith(ext);
  }

  // Prefixo com **
  if (lowerPattern.endsWith("/**")) {
    const prefix = lowerPattern.slice(0, -3);
    return lowerPath === prefix || lowerPath.startsWith(`${prefix}/`);
  }

  // **/migrations/**
  if (lowerPattern.includes("**/")) {
    const regex = globToRegExp(lowerPattern);
    return regex.test(lowerPath);
  }

  // docker-compose*
  if (lowerPattern.endsWith("*") && !lowerPattern.includes("/")) {
    const prefix = lowerPattern.slice(0, -1);
    const base = lowerPath.split("/").pop() ?? lowerPath;
    return base.startsWith(prefix);
  }

  // arquivo exato na raiz ou em qualquer pasta
  if (!lowerPattern.includes("*") && !lowerPattern.includes("/")) {
    const base = lowerPath.split("/").pop() ?? lowerPath;
    return base === lowerPattern;
  }

  if (!lowerPattern.includes("*")) {
    return lowerPath === lowerPattern || lowerPath.endsWith(`/${lowerPattern}`);
  }

  return globToRegExp(lowerPattern).test(lowerPath);
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{GLOBSTAR}}/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}
