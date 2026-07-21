import { BriefingValidationError } from "../errors/index.js";
import type { EmployeeBriefing } from "./employee-briefing.js";

/** Valida os campos minimos de um briefing. Lanca em caso de invalidez. */
export function validateBriefing(briefing: EmployeeBriefing): void {
  const issues: string[] = [];
  if (!briefing.project?.trim()) {
    issues.push("projeto ausente");
  }
  if (!briefing.objective?.trim()) {
    issues.push("objetivo ausente");
  }
  if (!Array.isArray(briefing.tasks)) {
    issues.push("tasks deve ser uma lista");
  }
  if (issues.length > 0) {
    throw new BriefingValidationError(issues);
  }
}
