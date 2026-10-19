import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  approvalBlocker,
  countByStatus,
  decide,
  exportApproved,
  parseRun,
  reopen,
  replaceDraft,
} from "@/modules/store-flow/review-queue";

const HERE = dirname(fileURLToPath(import.meta.url));
/** Saída real do CLI `run:csv` com o CSV de exemplo (modo deterministic). */
const FIXTURE = readFileSync(join(HERE, "fixtures", "store-flow-rodada.json"), "utf8");

describe("Sala de Aprovação — Store Flow", () => {
  it("lê a rodada gerada pelo CLI do pacote", () => {
    const run = parseRun(FIXTURE);
    expect(run.curated.length).toBe(2);
    expect(run.drafts.length).toBe(8);
    expect(run.drafts[0]?.variant).toBe("A");
    expect(run.drafts[1]?.angleLabel).toBe("Oferta");
    expect(countByStatus(run)).toEqual({ PENDING_APPROVAL: 8, APPROVED: 0, REJECTED: 0 });
  });

  it("recusa arquivo que não é rodada", () => {
    expect(() => parseRun("oi")).toThrow(/não é um JSON/);
    expect(() => parseRun('{"a":1}')).toThrow(/não é uma rodada/);
    expect(() => parseRun('{"curated":[],"drafts":[{"id":"x"}]}')).toThrow(/incompleto/);
  });

  it("com link sem rastreio, exige trocar a URL pelo link do portal e guarda o novo link", () => {
    const run = parseRun(FIXTURE);
    const draft = run.drafts[0]!;
    expect(approvalBlocker(draft, draft.text, { linkPending: true })).toMatch(/Troque a URL/);
    expect(() => decide(draft, "APPROVED", draft.text, { linkPending: true })).toThrow(/Troque/);

    const edited = draft.text.replace(draft.affiliateUrl, "https://s.afiliado.example/abc123");
    const approved = decide(draft, "APPROVED", edited, { linkPending: true });
    expect(approved.status).toBe("APPROVED");
    expect(approved.affiliateUrl).toBe("https://s.afiliado.example/abc123");
  });

  it("não aprova sem o aviso de afiliado; recusar e desfazer funcionam", () => {
    const run = parseRun(FIXTURE);
    const draft = run.drafts[1]!;
    const noDisclosure = draft.text.replace(draft.disclosure, "");
    expect(() => decide(draft, "APPROVED", noDisclosure)).toThrow(/aviso/);

    const rejected = decide(draft, "REJECTED");
    expect(rejected.status).toBe("REJECTED");
    expect(reopen(rejected).status).toBe("PENDING_APPROVAL");
  });

  it("exporta só os aprovados", () => {
    let run = parseRun(FIXTURE);
    const [a, b] = run.drafts;
    run = replaceDraft(run, decide(a!, "APPROVED"));
    run = replaceDraft(run, decide(b!, "REJECTED"));
    const exported = JSON.parse(exportApproved(run)) as { id: string }[];
    expect(exported.map((d) => d.id)).toEqual([a!.id]);
    expect(countByStatus(run)).toEqual({ PENDING_APPROVAL: 6, APPROVED: 1, REJECTED: 1 });
  });
});
