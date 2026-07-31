/**
 * Porta Caddy injetavel — somente validate (sem reload/restart nesta sprint).
 */
export interface CaddyValidateResult {
  readonly valid: boolean;
  readonly path: string;
  readonly messages: readonly string[];
}

export interface CaddyActionClient {
  validate(input: {
    readonly workspaceId: string;
    readonly target: string;
  }): Promise<CaddyValidateResult>;
}

export class MemoryCaddyActionClient implements CaddyActionClient {
  private readonly results = new Map<string, CaddyValidateResult>();

  seed(workspaceId: string, result: CaddyValidateResult): void {
    this.results.set(`${workspaceId}::${result.path}`, result);
  }

  async validate(input: {
    readonly workspaceId: string;
    readonly target: string;
  }): Promise<CaddyValidateResult> {
    const found = this.results.get(`${input.workspaceId}::${input.target}`);
    if (!found) {
      throw new Error(`Caddyfile nao encontrado: ${input.target}`);
    }
    return found;
  }
}
