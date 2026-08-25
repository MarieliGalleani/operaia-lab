import { DomainError } from "@operaia/shared";

export class OfficeUnavailableError extends DomainError {
  readonly code = "OFFICE_UNAVAILABLE";
  readonly httpStatus = 503;

  constructor(
    message: string,
    readonly degradations: readonly string[] = [],
  ) {
    super(message);
  }
}
