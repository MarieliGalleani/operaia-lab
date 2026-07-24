/**
 * Prova de execucao Brain (Parte 4) — instrumentacao Runtime → Brain → LLM.
 *
 * NAO e path de produto: script de evidencia. LLM = Deterministic (MOCK).
 * Gera IDs de correlacao locais (executionId/sessionId) — o EmployeeRunner
 * de produto NAO emite esses campos hoje.
 */
import {
  DeterministicLLMProvider,
  ObservableLLMProvider,
  RecordingLLMObserver,
  type LLMCompletion,
  type LLMMessage,
  type LLMProvider,
} from "@operaia/ai-core";
import { Specialization } from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import { randomUUID } from "node:crypto";
import { MagBrain } from "../../../../../packages/employees/cto-mag/src/mag-brain.js";
import { SpecialistBrain } from "../../../../../packages/employees/specialist-kit/src/specialist-brain.js";
import { createDigitalOffice } from "./office-composition.js";

interface BrainCallTrace {
  readonly brainClass: string;
  readonly domainHint: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly analyzed: string;
  readonly decision: string;
  readonly recommendations: readonly string[];
  readonly nextActions: readonly string[];
}

interface LlmCallTrace {
  readonly startedAt: string;
  readonly systemPromptSummary: string;
  readonly userPromptSummary: string;
  readonly completion: string;
  readonly model: string;
  readonly provider: string;
}

interface MissionSpec {
  readonly label: string;
  readonly specialization: (typeof Specialization)[keyof typeof Specialization];
  readonly task: string;
  readonly reason: string;
}

const PART4_MISSIONS: readonly MissionSpec[] = [
  {
    label: "Mag — engenharia",
    specialization: Specialization.SOFTWARE_ENGINEERING,
    task: "Elaborar plano tecnico para autenticacao na NEXO",
    reason: "Necessidade tecnica de implementacao",
  },
  {
    label: "Luna — design",
    specialization: Specialization.PRODUCT_DESIGN,
    task: "Mapear jornada e friccoes do fluxo de autenticacao",
    reason: "Necessidade de design de produto / UX",
  },
  {
    label: "Nexus — produto",
    specialization: Specialization.PRODUCT_MANAGEMENT,
    task: "Priorizar backlog da autenticacao por impacto",
    reason: "Necessidade de gestao de produto",
  },
  {
    label: "Atlas — automacao",
    specialization: Specialization.AUTOMATION,
    task: "Desenhar automacao da sincronizacao offline",
    reason: "Necessidade de automacao e integracoes",
  },
  {
    label: "Aurora — financas",
    specialization: Specialization.FINANCE,
    task: "Estimar custo e risco financeiro da iniciativa NEXO",
    reason: "Necessidade financeira",
  },
  {
    label: "Themis — juridico",
    specialization: Specialization.LEGAL,
    task: "Revisar exposicao LGPD do fluxo de autenticacao",
    reason: "Necessidade juridica / compliance",
  },
  {
    label: "Mercurio — marketing",
    specialization: Specialization.MARKETING,
    task: "Planejar narrativa de lancamento da autenticacao",
    reason: "Necessidade de marketing",
  },
  {
    label: "Orion — operacoes",
    specialization: Specialization.OPERATIONS,
    task: "Definir rituais e handoffs operacionais pos-auth",
    reason: "Necessidade operacional",
  },
];

const brainCalls: BrainCallTrace[] = [];
const llmCalls: LlmCallTrace[] = [];

function summarizePrompt(content: string, max = 220): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}

function identityFromSystem(system: string): string {
  const match = /Voce e ([^,]+)/i.exec(system);
  return match?.[1]?.trim() ?? "desconhecido";
}

/** LLM mock que grava prompts e devolve conclusao distinta por identidade. */
class ProofCapturingLLM implements LLMProvider {
  readonly name = "proof-deterministic";
  private readonly inner = new DeterministicLLMProvider();

  async complete(messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    const system =
      messages.find((message) => message.role === "system")?.content ?? "";
    const user =
      messages.find((message) => message.role === "user")?.content ?? "";
    const identity = identityFromSystem(system);
    const isMag = /Mag,\s*CTO/i.test(system) || /\ba Mag\b/i.test(identity);
    const domainLine =
      user
        .split("\n")
        .find(
          (line) =>
            line.startsWith("Dominio:") ||
            line.startsWith("Objetivo tecnico:"),
        )
        ?.trim() ?? "";

    const startedAt = new Date().toISOString();
    // Conclusao MOCK distinta por brain — prova que o prompt do brain chegou aqui.
    const content = isMag
      ? `[MOCK MagBrain] Conclusao tecnica: autenticacao em etapas com testes; ${domainLine || "engenharia"}.`
      : `[MOCK SpecialistBrain/${identity}] Conclusao de dominio: ${domainLine || identity} — acoes alinhadas ao briefing.`;

    llmCalls.push({
      startedAt,
      systemPromptSummary: summarizePrompt(system),
      userPromptSummary: summarizePrompt(user),
      completion: content,
      model: "deterministic-proof",
      provider: this.name,
    });

    // Ainda exercita o Deterministic interno (mesmo path de teste da auditoria).
    await this.inner.complete(messages);
    return { content, model: "deterministic-proof" };
  }
}

function installBrainHooks(): () => void {
  const specialistOriginal = SpecialistBrain.prototype.decide;
  const magOriginal = MagBrain.prototype.decide;

  SpecialistBrain.prototype.decide = async function decide(
    this: SpecialistBrain,
    briefing,
  ) {
    const started = Date.now();
    const startedAt = new Date().toISOString();
    const result = await specialistOriginal.call(this, briefing);
    const config = (this as unknown as { config: { domainLabel: string } })
      .config;
    brainCalls.push({
      brainClass: "SpecialistBrain",
      domainHint: config.domainLabel,
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      analyzed: result.analyzed,
      decision: result.decision,
      recommendations: result.recommendations,
      nextActions: result.nextActions,
    });
    return result;
  };

  MagBrain.prototype.decide = async function decide(this: MagBrain, briefing) {
    const started = Date.now();
    const startedAt = new Date().toISOString();
    const result = await magOriginal.call(this, briefing);
    brainCalls.push({
      brainClass: "MagBrain",
      domainHint: "software engineering / Mag",
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      analyzed: result.analyzed,
      decision: result.decision,
      recommendations: result.recommendations,
      nextActions: result.nextActions,
    });
    return result;
  };

  return () => {
    SpecialistBrain.prototype.decide = specialistOriginal;
    MagBrain.prototype.decide = magOriginal;
  };
}

async function main(): Promise<void> {
  const restore = installBrainHooks();
  const observer = new RecordingLLMObserver();
  const capturing = new ProofCapturingLLM();
  const llm = new ObservableLLMProvider(capturing, observer);
  const office = createDigitalOffice({ llm });

  const workspaceId = "nexo";
  const sessionId = `proof-session-${randomUUID()}`;
  const context = {
    workspace: {
      workspaceId,
      name: "NEXO",
      tasks: [
        {
          id: "t1",
          title: "Implementar autenticacao",
          status: TaskStatus.TODO,
          impact: 5,
          urgency: 5,
        },
        {
          id: "t2",
          title: "Sincronizar dados offline",
          status: TaskStatus.TODO,
          impact: 4,
          urgency: 3,
          dependsOn: ["t1"],
        },
        {
          id: "t3",
          title: "Escrever documentacao",
          status: TaskStatus.DONE,
        },
      ],
    },
    objective: "Finalizar desenvolvimento da NEXO",
  };

  const reports = [];

  for (const mission of PART4_MISSIONS) {
    const executionId = `proof-exec-${randomUUID()}`;
    brainCalls.length = 0;
    llmCalls.length = 0;
    observer.clear();

    const missionStarted = Date.now();
    const startedAt = new Date().toISOString();

    const outcomes = await office.delegation.run(
      [
        {
          specialization: mission.specialization,
          reason: mission.reason,
          task: mission.task,
        },
      ],
      context,
    );

    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - missionStarted;
    const outcome = outcomes[0];
    const brain = brainCalls[0];
    const llmCall = llmCalls[0];
    const llmEvents = observer.snapshot();

    reports.push({
      mission: mission.label,
      executionId,
      sessionId,
      workspaceId,
      employeeId: outcome?.employeeId ?? null,
      specialization: mission.specialization,
      runtimeId: null,
      runtimeIdNote:
        "EmployeeRunner/DelegationService nao emitem runtimeId no produto atual.",
      startedAt,
      endedAt,
      durationMs,
      matched: outcome?.matched ?? false,
      brain: brain
        ? {
            className: brain.brainClass,
            domainHint: brain.domainHint,
            analyzed: brain.analyzed,
            decision: brain.decision,
            recommendations: brain.recommendations,
            nextActions: brain.nextActions,
            brainDurationMs: brain.durationMs,
          }
        : null,
      policies: [
        "DefaultResponsePolicy",
        "DefaultQualityPolicy",
        "DefaultDelegationPolicy",
      ],
      policiesNote:
        "Carregadas via EmployeeFactory (blueprint sem override) → BaseEmployee.work",
      llmPrompt: llmCall
        ? {
            system: llmCall.systemPromptSummary,
            user: llmCall.userPromptSummary,
            mock: true,
          }
        : null,
      brainResultToCeo: {
        reportSummary: outcome?.result?.output.report.summary ?? null,
        reportPlan: outcome?.result?.output.report.plan ?? null,
        reportAnalysis: outcome?.result?.output.report.analysis ?? null,
        qualityPassed: outcome?.result?.output.quality.passed ?? null,
      },
      proofTree: [
        "DelegationService.run",
        "→ EmployeeMatcher.match(specialization)",
        `→ RegisteredEmployee.create({ llm }) → BaseEmployee + ${brain?.brainClass ?? "?"}`,
        "→ EmployeeRunner.run → briefing adapter",
        "→ BaseEmployee.work",
        "→ brain.decide (hook capturou)",
        "→ llm.complete (prompt capturado)",
        "→ ResponsePolicy.build → QualityPolicy.validate",
        "→ DelegationOutcome.result (retorno ao CEO)",
      ],
      observability: {
        openTelemetry: false,
        structuredLogs: false,
        recordingLLMObserverEvents: llmEvents,
        brainHookCalls: brainCalls.length,
        llmPromptCaptures: llmCalls.length,
      },
      mocks: {
        llmProvider: "DeterministicLLMProvider + ProofCapturingLLM (MOCK)",
        executionIdGeneratedLocally: true,
        sessionIdGeneratedLocally: true,
        productPathDoesNotPersistTheseIds: true,
      },
    });
  }

  restore();

  const uniqueness = {
    brainClasses: [...new Set(reports.map((r) => r.brain?.className))],
    domainHints: reports.map((r) => r.brain?.domainHint),
    analyzedFingerprints: reports.map((r) => r.brain?.analyzed),
    systemPromptIdentities: reports.map((r) =>
      identityFromSystem(r.llmPrompt?.system ?? ""),
    ),
    planFirstSteps: reports.map((r) => r.brainResultToCeo.reportPlan?.[0]),
  };

  console.log(
    JSON.stringify(
      {
        title: "Prova Brain — Parte 4",
        generatedAt: new Date().toISOString(),
        verdict:
          reports.every(
            (r) =>
              r.matched &&
              r.brain &&
              r.llmPrompt &&
              r.observability.brainHookCalls === 1 &&
              r.observability.llmPromptCaptures === 1,
          ) &&
          new Set(uniqueness.domainHints).size === reports.length &&
          new Set(uniqueness.analyzedFingerprints).size >= 2,
        uniqueness,
        missions: reports,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
