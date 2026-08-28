/**
 * Elenco real da Equipe Digital — a MESMA equipe em qualquer andar.
 *
 * Fonte da verdade: os 9 funcionarios reais do runtime (packages/employees/*,
 * confirmados nos logs do operaia-lab-api: operaia-ceo/MANAGEMENT,
 * cto-mag/SOFTWARE_ENGINEERING, luna/PRODUCT_DESIGN, nexus/PRODUCT_MANAGEMENT,
 * atlas/AUTOMATION, aurora/FINANCE, themis/LEGAL, mercurio/MARKETING,
 * orion/OPERATIONS). Nao inventar personagem novo por cliente — um andar
 * novo reaproveita este mesmo elenco.
 *
 * Sprite: so existem 5 desenhos prontos (opera/mag/luna/atlas/aurora).
 * Mercurio/Nexus/Themis/Orion reaproveitam um sprite existente ate ter
 * arte propria (Fase 2) — marcado explicitamente abaixo, sem fingir.
 */

import type { ActorKind } from "../../virtual-world/contracts/components";

export interface RealAgentMeta {
  readonly id: string;
  readonly name: string;
  readonly kind: ActorKind;
  readonly stateId: string;
  readonly spriteId: string;
  readonly tags: readonly string[];
}

export const REAL_AGENT_ROSTER: readonly RealAgentMeta[] = [
  {
    id: "opera",
    name: "CEO — Opera",
    kind: "agent",
    stateId: "STRATEGY",
    spriteId: "char-opera",
    tags: ["executive", "leader", "management"],
  },
  {
    id: "mag",
    name: "CTO — Mag",
    kind: "agent",
    stateId: "CODING",
    spriteId: "char-mag",
    tags: ["technology", "software-engineering"],
  },
  {
    id: "luna",
    name: "Product Designer — Luna",
    kind: "agent",
    stateId: "WORKING",
    spriteId: "char-luna",
    tags: ["design", "product-design"],
  },
  {
    id: "nexus",
    name: "Product Manager — Nexus",
    kind: "agent",
    stateId: "DOCUMENTING",
    spriteId: "char-mag", // TODO Fase 2: sprite proprio
    tags: ["product", "product-management"],
  },
  {
    id: "atlas",
    name: "Automation Specialist — Atlas",
    kind: "agent",
    stateId: "WORKING",
    spriteId: "char-atlas",
    tags: ["automation"],
  },
  {
    id: "aurora",
    name: "Finance Lead — Aurora",
    kind: "agent",
    stateId: "AVAILABLE",
    spriteId: "char-aurora",
    tags: ["finance"],
  },
  {
    id: "themis",
    name: "Legal — Themis",
    kind: "agent",
    stateId: "DOCUMENTING",
    spriteId: "char-atlas", // TODO Fase 2: sprite proprio
    tags: ["legal"],
  },
  {
    id: "mercurio",
    name: "Marketing — Mercúrio",
    kind: "agent",
    stateId: "AVAILABLE",
    spriteId: "char-luna", // TODO Fase 2: sprite proprio
    tags: ["marketing"],
  },
  {
    id: "orion",
    name: "Operations — Orion",
    kind: "agent",
    stateId: "AVAILABLE",
    spriteId: "char-aurora", // TODO Fase 2: sprite proprio
    tags: ["operations"],
  },
] as const;
