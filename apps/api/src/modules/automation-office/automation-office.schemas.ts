import { z } from "zod";

export const riskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const autonomyLevelSchema = z.enum([
  "READ_PLAN",
  "CONTROLLED",
  "AUTONOMOUS",
  "HUMAN_APPROVAL",
]);
export const approvalStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "MODIFIED",
  "EXPIRED",
  "CANCELLED",
]);
export const executionStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "WAITING_APPROVAL",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
]);

export const commandCenterResponseSchema = z.object({
  generatedAt: z.string(),
  source: z.literal("api"),
  backendDependency: z.literal(false),
  status: z.object({
    level: z.enum(["OPERATING", "ATTENTION", "PROBLEM"]),
    label: z.string(),
    summary: z.string(),
    workers: z.object({
      alive: z.number(),
      expected: z.number(),
      busy: z.number(),
      available: z.number(),
    }),
  }),
  attention: z.array(
    z.object({
      id: z.string(),
      kind: z.enum([
        "approval",
        "block",
        "failure",
        "credential",
        "risk",
        "decision",
      ]),
      severity: z.enum(["blocker", "critical", "warning", "info"]),
      title: z.string(),
      detail: z.string(),
      workspaceId: z.string().optional(),
      workspaceName: z.string().optional(),
      risk: riskLevelSchema.optional(),
      href: z.string(),
    }),
  ),
  pendingApprovals: z.number(),
  inProgress: z.array(z.object({
    id: z.string(),
    workspaceId: z.string(),
    workspaceName: z.string(),
    objective: z.string(),
    ownerEmployeeId: z.string(),
    stepLabel: z.string(),
    progressLabel: z.string(),
    risk: riskLevelSchema,
    href: z.string(),
    etaLabel: z.string().optional(),
  })),
  decisions: z.array(z.object({
    id: z.string(),
    title: z.string(),
    rationale: z.string(),
    risk: riskLevelSchema,
    confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
    autonomy: autonomyLevelSchema,
    nextAction: z.string(),
    createdAt: z.string(),
    workspaceName: z.string().optional(),
  })),
  completed: z.array(z.object({
    id: z.string(),
    title: z.string(),
    finishedAt: z.string().nullable(),
    kind: z.string(),
    href: z.string(),
    workspaceName: z.string().optional(),
    deliveredByEmployeeIds: z.array(z.string()),
  })),
  team: z.array(z.object({
    employeeId: z.string(),
    name: z.string(),
    specialization: z.string(),
    status: z.string(),
    currentMissionId: z.string().nullable(),
    currentObjective: z.string().nullable(),
  })),
  idle: z.boolean(),
  zeroMessage: z.string(),
});

export const interpretDemandBodySchema = z.object({
  text: z.string().min(1),
  workspaceId: z.string().min(1),
});

export const interpretDemandResponseSchema = z.object({
  source: z.literal("api"),
  backendDependency: z.literal(false),
  brief: z.object({
    demandId: z.string(),
    workspaceId: z.string(),
    workspaceName: z.string(),
    objective: z.string(),
    context: z.string(),
    expectedOutcome: z.string(),
    constraints: z.array(z.string()),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    risk: riskLevelSchema,
    autonomy: autonomyLevelSchema,
    dependencies: z.array(z.string()),
  }),
  plan: z.object({
    demandId: z.string(),
    steps: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        assigneeEmployeeId: z.string().optional(),
        assigneeLabel: z.string().optional(),
        dependencies: z.array(z.string()),
        risk: riskLevelSchema,
        autonomy: autonomyLevelSchema,
        expectedResult: z.string(),
      }),
    ),
  }),
});

export const executeDemandBodySchema = z.object({
  autonomy: autonomyLevelSchema,
});

export const executeDemandResponseSchema = z.object({
  source: z.literal("api"),
  backendDependency: z.literal(false),
  accepted: z.boolean(),
  message: z.string(),
  demandId: z.string(),
  missionId: z.string().optional(),
  gateDecision: z.string().optional(),
  redirectTo: z.string().optional(),
});

export const autonomyLoopStageSchema = z.object({
  stage: z.enum([
    "intake",
    "planning",
    "delegation",
    "mission",
    "execution",
    "validation",
    "delivery",
  ]),
  present: z.boolean(),
  summary: z.string(),
  details: z.record(z.string(), z.unknown()),
});

export const autonomyLoopEvidenceSchema = z.object({
  demandId: z.string(),
  correlationId: z.string(),
  missionId: z.string().nullable(),
  demandStatus: z.string(),
  gateDecision: z.string().nullable(),
  stages: z.array(autonomyLoopStageSchema),
  loopEvidenceComplete: z.boolean(),
});

export const autonomyLoopHarnessSchema = z.object({
  ok: z.boolean(),
  demandId: z.string(),
  correlationId: z.string(),
  missingStages: z.array(
    z.enum([
      "intake",
      "planning",
      "delegation",
      "mission",
      "execution",
      "validation",
      "delivery",
    ]),
  ),
  evidence: autonomyLoopEvidenceSchema,
  message: z.string(),
});

export const approvalListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  risk: riskLevelSchema,
  status: approvalStatusSchema,
  createdAt: z.string(),
  actionSummary: z.string(),
});

export const approvalDetailSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  action: z.string(),
  risk: riskLevelSchema,
  impact: z.string(),
  reason: z.string(),
  planSummary: z.string(),
  validated: z.array(z.string()),
  ifApprove: z.string(),
  ifReject: z.string(),
  officeDecision: z.string(),
  status: approvalStatusSchema,
  createdAt: z.string(),
});

export const approvalActionResponseSchema = z.object({
  source: z.literal("api"),
  backendDependency: z.literal(false),
  status: approvalStatusSchema,
  message: z.string(),
});

export const decisionTraceSchema = z.object({
  decisionId: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  missionId: z.string().optional(),
  objective: z.string(),
  context: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string() })),
  chosenOptionId: z.string(),
  rationale: z.string(),
  risk: riskLevelSchema,
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  autonomy: autonomyLevelSchema,
  impact: z.string(),
  nextAction: z.string(),
  responsibleEmployeeId: z.string(),
  responsibleLabel: z.string(),
  createdAt: z.string(),
});

export const automationListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  objective: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  status: z.string(),
  triggerLabel: z.string(),
  autonomy: autonomyLevelSchema,
  risk: riskLevelSchema,
  lastExecutionAt: z.string().nullable(),
  lastSuccess: z.boolean().nullable(),
});

export const automationDetailSchema = automationListItemSchema.extend({
  actions: z.array(z.string()),
  nextExecutionAt: z.string().nullable(),
  history: z.array(
    z.object({
      executionId: z.string(),
      at: z.string(),
      status: executionStatusSchema,
    }),
  ),
});

export const executionListItemSchema = z.object({
  id: z.string(),
  automationId: z.string(),
  automationName: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  status: executionStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});

export const executionDetailSchema = executionListItemSchema.extend({
  triggerLabel: z.string(),
  steps: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      status: z.string(),
      responsibleLabel: z.string().optional(),
      durationMs: z.number().optional(),
      resultSummary: z.string().optional(),
      error: z.string().optional(),
      canRetry: z.boolean().optional(),
      nextStepLabel: z.string().optional(),
    }),
  ),
  /** P0.3E projection flags — evidência Core existente, sem novos estados Demand. */
  autonomyLoop: z
    .object({
      executeChildCount: z.number(),
      hasDeliveryCreated: z.boolean(),
      hasValidResult: z.boolean(),
      eventTypes: z.array(z.string()),
    })
    .optional(),
});

export const workspaceContextSchema = z.object({
  workspaceId: z.string(),
  name: z.string(),
  kind: z.enum(["lab", "client"]),
  statusLabel: z.string(),
  automationsActive: z.number(),
  missionsOpen: z.number(),
  decisionsRecent: z.number(),
  approvalsPending: z.number(),
  integrations: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      configured: z.boolean(),
    }),
  ),
  credentials: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      configured: z.boolean(),
    }),
  ),
});

export const officeUnavailableSchema = z.object({
  code: z.literal("OFFICE_UNAVAILABLE"),
  message: z.string(),
  degradations: z.array(z.string()),
});
