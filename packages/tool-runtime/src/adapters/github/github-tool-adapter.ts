/**
 * GitHubToolAdapter — implementa ToolPorts de leitura via API GitHub.
 * Desacoplado do Employee Runtime. Sem escrita.
 */
import { ToolErrorCode, toolError, type ToolError } from "../../result.js";
import { toolFail, toolOk, type ToolResult } from "../../tool-result.js";
import { ToolId, type ToolId as ToolIdType } from "../../tool-id.js";
import type {
  CommitInfo,
  FileContent,
  IssueInfo,
  ListDirectoryResult,
  PullRequestInfo,
  ReadCommitInput,
  ReadFileInput,
  ReadIssueInput,
  ReadPullRequestInput,
  ReadRepositoryInput,
  ReadWorkflowInput,
  RepositoryInfo,
  SearchFilesInput,
  SearchFilesResult,
  ToolPorts,
  WorkflowInfo,
  ListDirectoryInput,
} from "../../tools.js";
import {
  GithubApiClient,
  GithubApiRequestError,
  parseOwnerRepo,
  type GithubApiClientOptions,
} from "./github-api-client.js";
import type { GithubRepositoryResolver } from "./github-repository-resolver.js";
import { MemoryTtlCache } from "./memory-ttl-cache.js";

const CACHE_TTL_MS = 60_000;

export interface GitHubToolAdapterOptions {
  readonly workspaceId: string;
  readonly resolver: GithubRepositoryResolver;
  readonly client?: GithubApiClient;
  readonly clientOptions?: GithubApiClientOptions;
  readonly cache?: MemoryTtlCache;
  readonly cacheTtlMs?: number;
  readonly employeeId?: string;
}

export class GitHubToolAdapter {
  private readonly workspaceId: string;
  private readonly resolver: GithubRepositoryResolver;
  private readonly client: GithubApiClient;
  private readonly cache: MemoryTtlCache;
  private readonly cacheTtlMs: number;
  private readonly employeeId?: string;

  constructor(options: GitHubToolAdapterOptions) {
    this.workspaceId = options.workspaceId;
    this.resolver = options.resolver;
    this.client =
      options.client ?? new GithubApiClient(options.clientOptions ?? {});
    this.cache = options.cache ?? new MemoryTtlCache(CACHE_TTL_MS);
    this.cacheTtlMs = options.cacheTtlMs ?? CACHE_TTL_MS;
    this.employeeId = options.employeeId;
  }

  /** Expoe as ports GitHub para o ToolContext. */
  asToolPorts(): ToolPorts {
    return {
      readRepository: { execute: (input) => this.readRepository(input) },
      listDirectory: { execute: (input) => this.listDirectory(input) },
      readFile: { execute: (input) => this.readFile(input) },
      searchFiles: { execute: (input) => this.searchFiles(input) },
      readCommit: { execute: (input) => this.readCommit(input) },
      readPullRequest: { execute: (input) => this.readPullRequest(input) },
      readIssue: { execute: (input) => this.readIssue(input) },
      readWorkflow: { execute: (input) => this.readWorkflow(input) },
    };
  }

  async readRepository(
    input: ReadRepositoryInput = {},
  ): Promise<ToolResult<RepositoryInfo>> {
    return this.guard(ToolId.readRepository, async () => {
      const repository = await this.resolveRepo(input.repository);
      const cacheKey = `repo:${repository}`;
      const cached = this.cache.get<RepositoryInfo>(cacheKey);
      if (cached) {
        return toolOk(cached);
      }

      const { owner, repo, fullName } = parseOwnerRepo(repository);
      const raw = (await this.client.getJson(
        `/repos/${owner}/${repo}`,
      )) as RepoPayload;

      const data: RepositoryInfo = {
        repository: fullName,
        owner,
        name: repo,
        defaultBranch:
          typeof raw.default_branch === "string" && raw.default_branch.trim()
            ? raw.default_branch
            : "main",
        description:
          typeof raw.description === "string" ? raw.description : null,
        primaryLanguage:
          typeof raw.language === "string" ? raw.language : null,
        updatedAt:
          (typeof raw.pushed_at === "string" && raw.pushed_at) ||
          (typeof raw.updated_at === "string" && raw.updated_at) ||
          null,
      };
      this.cache.set(cacheKey, data, this.cacheTtlMs);
      return toolOk(data);
    });
  }

  async listDirectory(
    input: ListDirectoryInput,
  ): Promise<ToolResult<ListDirectoryResult>> {
    return this.guard(ToolId.listDirectory, async () => {
      const repository = await this.resolveRepo(input.repository);
      const path = (input.path ?? "").replace(/^\/+/, "");
      const ref = await this.resolveContentRef(input.ref);
      const cacheKey = `tree:${repository}:${ref ?? "default"}:${path}`;
      const cached = this.cache.get<ListDirectoryResult>(cacheKey);
      if (cached) {
        return toolOk(cached);
      }

      const { owner, repo, fullName } = parseOwnerRepo(repository);
      const qs = ref ? `?ref=${encodeURIComponent(ref)}` : "";
      const apiPath = path
        ? `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}${qs}`
        : `/repos/${owner}/${repo}/contents${qs}`;

      const raw = await this.client.getJson(apiPath);
      const entries = normalizeContents(raw).map((item) => ({
        name: item.name ?? "",
        path: item.path ?? "",
        type: mapEntryType(item.type),
        size: typeof item.size === "number" ? item.size : null,
      }));

      const data: ListDirectoryResult = {
        repository: fullName,
        path: path || ".",
        entries,
      };
      this.cache.set(cacheKey, data, this.cacheTtlMs);
      return toolOk(data);
    });
  }

  async readFile(input: ReadFileInput): Promise<ToolResult<FileContent>> {
    return this.guard(ToolId.readFile, async () => {
      if (!input.path?.trim()) {
        return this.invalid(ToolId.readFile, "path obrigatorio");
      }
      const repository = await this.resolveRepo(input.repository);
      const path = input.path.replace(/^\/+/, "");
      const ref = await this.resolveContentRef(input.ref);
      const cacheKey = `file:${repository}:${ref ?? "default"}:${path}`;
      const cached = this.cache.get<FileContent>(cacheKey);
      if (cached) {
        return toolOk(cached);
      }

      const { owner, repo, fullName } = parseOwnerRepo(repository);
      const qs = ref ? `?ref=${encodeURIComponent(ref)}` : "";
      const raw = (await this.client.getJson(
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}${qs}`,
      )) as ContentPayload;

      if (Array.isArray(raw) || raw.type === "dir") {
        return toolFail(
          this.err(ToolId.readFile, ToolErrorCode.INVALID_INPUT, "path e diretorio"),
        );
      }

      const encoding =
        raw.encoding === "base64" ? "base64" : ("utf-8" as const);
      let content = typeof raw.content === "string" ? raw.content : "";
      if (encoding === "base64" && content) {
        content = Buffer.from(content.replace(/\n/g, ""), "base64").toString(
          "utf-8",
        );
      }

      const data: FileContent = {
        repository: fullName,
        path: typeof raw.path === "string" ? raw.path : path,
        content,
        encoding: "utf-8",
        size:
          typeof raw.size === "number"
            ? raw.size
            : Buffer.byteLength(content, "utf-8"),
        sha: typeof raw.sha === "string" ? raw.sha : null,
      };
      this.cache.set(cacheKey, data, this.cacheTtlMs);
      return toolOk(data);
    });
  }

  async searchFiles(
    input: SearchFilesInput,
  ): Promise<ToolResult<SearchFilesResult>> {
    return this.guard(ToolId.searchFiles, async () => {
      if (!input.query?.trim()) {
        return this.invalid(ToolId.searchFiles, "query obrigatoria");
      }
      const repository = await this.resolveRepo(input.repository);
      const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
      const ref = await this.resolveContentRef(input.ref);
      const cacheKey = `search:${repository}:${ref ?? "default"}:${input.query}:${input.pathPrefix ?? ""}:${limit}`;
      const cached = this.cache.get<SearchFilesResult>(cacheKey);
      if (cached) {
        return toolOk(cached);
      }

      const { owner, repo, fullName } = parseOwnerRepo(repository);
      const pathFilter = input.pathPrefix?.trim()
        ? ` path:${input.pathPrefix.trim()}`
        : "";
      const q = `repo:${owner}/${repo}${pathFilter} filename:${input.query.trim()}`;

      let hits: SearchFilesResult["hits"][number][] = [];
      try {
        const raw = (await this.client.getJson(
          `/search/code?q=${encodeURIComponent(q)}&per_page=${limit}`,
        )) as SearchCodePayload;
        hits =
          Array.isArray(raw.items)
            ? raw.items
                .map((item) => ({
                  path: typeof item.path === "string" ? item.path : "",
                  score:
                    typeof item.score === "number" ? item.score : undefined,
                }))
                .filter((item) => item.path)
            : [];
      } catch {
        hits = [];
      }

      // Fallback: list tree and filter by name/path (sem indexacao propria).
      if (hits.length === 0) {
        hits = await this.searchViaTree(
          fullName,
          input.query,
          input.pathPrefix,
          limit,
          ref,
        );
      }

      const data: SearchFilesResult = {
        repository: fullName,
        query: input.query,
        hits,
      };
      this.cache.set(cacheKey, data, this.cacheTtlMs);
      return toolOk(data);
    });
  }

  async readCommit(input: ReadCommitInput): Promise<ToolResult<CommitInfo>> {
    return this.guard(ToolId.readCommit, async () => {
      if (!input.sha?.trim()) {
        return this.invalid(ToolId.readCommit, "sha obrigatorio");
      }
      const repository = await this.resolveRepo(input.repository);
      const sha = input.sha.trim();
      const cacheKey = `commit:${repository}:${sha}`;
      const cached = this.cache.get<CommitInfo>(cacheKey);
      if (cached) {
        return toolOk(cached);
      }

      const { owner, repo, fullName } = parseOwnerRepo(repository);
      const raw = (await this.client.getJson(
        `/repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}`,
      )) as CommitPayload;

      const files = Array.isArray(raw.files) ? raw.files : [];
      const data: CommitInfo = {
        repository: fullName,
        sha: typeof raw.sha === "string" ? raw.sha : sha,
        message:
          typeof raw.commit?.message === "string" ? raw.commit.message : "",
        authorLogin:
          typeof raw.author?.login === "string" ? raw.author.login : null,
        authorName:
          typeof raw.commit?.author?.name === "string"
            ? raw.commit.author.name
            : null,
        committedAt:
          typeof raw.commit?.author?.date === "string"
            ? raw.commit.author.date
            : null,
        files: files
          .map((file) => file.filename)
          .filter((name): name is string => typeof name === "string"),
        fileChanges: files.map((file) => ({
          path: typeof file.filename === "string" ? file.filename : "",
          status: typeof file.status === "string" ? file.status : null,
        })),
        status: files[0]?.status ?? "committed",
      };
      this.cache.set(cacheKey, data, this.cacheTtlMs);
      return toolOk(data);
    });
  }

  async readPullRequest(
    input: ReadPullRequestInput,
  ): Promise<ToolResult<PullRequestInfo>> {
    return this.guard(ToolId.readPullRequest, async () => {
      if (!Number.isFinite(input.number)) {
        return this.invalid(ToolId.readPullRequest, "number obrigatorio");
      }
      const repository = await this.resolveRepo(input.repository);
      const cacheKey = `pr:${repository}:${input.number}`;
      const cached = this.cache.get<PullRequestInfo>(cacheKey);
      if (cached) {
        return toolOk(cached);
      }

      const { owner, repo, fullName } = parseOwnerRepo(repository);
      const raw = (await this.client.getJson(
        `/repos/${owner}/${repo}/pulls/${input.number}`,
      )) as PullPayload;

      const [commitsRaw, filesRaw] = await Promise.all([
        this.client.getJson(
          `/repos/${owner}/${repo}/pulls/${input.number}/commits?per_page=100`,
        ),
        this.client.getJson(
          `/repos/${owner}/${repo}/pulls/${input.number}/files?per_page=100`,
        ),
      ]);

      const commits = Array.isArray(commitsRaw)
        ? commitsRaw
            .map((row) =>
              typeof (row as { sha?: string }).sha === "string"
                ? (row as { sha: string }).sha
                : "",
            )
            .filter(Boolean)
        : [];
      const files = Array.isArray(filesRaw)
        ? filesRaw
            .map((row) =>
              typeof (row as { filename?: string }).filename === "string"
                ? (row as { filename: string }).filename
                : "",
            )
            .filter(Boolean)
        : [];

      const data: PullRequestInfo = {
        repository: fullName,
        number: input.number,
        title: typeof raw.title === "string" ? raw.title : "",
        description: typeof raw.body === "string" ? raw.body : null,
        state: typeof raw.state === "string" ? raw.state : "unknown",
        draft: Boolean(raw.draft),
        authorLogin:
          typeof raw.user?.login === "string" ? raw.user.login : null,
        baseRef:
          typeof raw.base?.ref === "string" ? raw.base.ref : null,
        headRef:
          typeof raw.head?.ref === "string" ? raw.head.ref : null,
        htmlUrl: typeof raw.html_url === "string" ? raw.html_url : null,
        commits,
        files,
      };
      this.cache.set(cacheKey, data, this.cacheTtlMs);
      return toolOk(data);
    });
  }

  async readIssue(input: ReadIssueInput): Promise<ToolResult<IssueInfo>> {
    return this.guard(ToolId.readIssue, async () => {
      if (!Number.isFinite(input.number)) {
        return this.invalid(ToolId.readIssue, "number obrigatorio");
      }
      const repository = await this.resolveRepo(input.repository);
      const cacheKey = `issue:${repository}:${input.number}`;
      const cached = this.cache.get<IssueInfo>(cacheKey);
      if (cached) {
        return toolOk(cached);
      }

      const { owner, repo, fullName } = parseOwnerRepo(repository);
      const raw = (await this.client.getJson(
        `/repos/${owner}/${repo}/issues/${input.number}`,
      )) as IssuePayload;

      const commentsRaw = (await this.client.getJson(
        `/repos/${owner}/${repo}/issues/${input.number}/comments?per_page=100`,
      )) as unknown;

      const comments = Array.isArray(commentsRaw)
        ? commentsRaw.map((row) => {
            const item = row as CommentPayload;
            return {
              id: typeof item.id === "number" ? item.id : 0,
              authorLogin:
                typeof item.user?.login === "string" ? item.user.login : null,
              body: typeof item.body === "string" ? item.body : "",
              createdAt:
                typeof item.created_at === "string" ? item.created_at : null,
            };
          })
        : [];

      const labels = Array.isArray(raw.labels)
        ? raw.labels
            .map((label) =>
              typeof label === "string"
                ? label
                : typeof label?.name === "string"
                  ? label.name
                  : "",
            )
            .filter(Boolean)
        : [];

      const data: IssueInfo = {
        repository: fullName,
        number: input.number,
        title: typeof raw.title === "string" ? raw.title : "",
        state: typeof raw.state === "string" ? raw.state : "unknown",
        authorLogin:
          typeof raw.user?.login === "string" ? raw.user.login : null,
        labels,
        htmlUrl: typeof raw.html_url === "string" ? raw.html_url : null,
        comments,
      };
      this.cache.set(cacheKey, data, this.cacheTtlMs);
      return toolOk(data);
    });
  }

  async readWorkflow(
    input: ReadWorkflowInput,
  ): Promise<ToolResult<WorkflowInfo>> {
    return this.guard(ToolId.readWorkflow, async () => {
      if (!input.workflowIdOrPath?.trim()) {
        return this.invalid(ToolId.readWorkflow, "workflowIdOrPath obrigatorio");
      }
      const repository = await this.resolveRepo(input.repository);
      const key = input.workflowIdOrPath.trim();
      const cacheKey = `workflow:${repository}:${key}`;
      const cached = this.cache.get<WorkflowInfo>(cacheKey);
      if (cached) {
        return toolOk(cached);
      }

      const { owner, repo, fullName } = parseOwnerRepo(repository);
      const workflow = (await this.client.getJson(
        `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(key)}`,
      )) as WorkflowPayload;

      const runs = (await this.client.getJson(
        `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(String(workflow.id ?? key))}/runs?per_page=1`,
      )) as WorkflowRunsPayload;

      const last = Array.isArray(runs.workflow_runs)
        ? runs.workflow_runs[0]
        : undefined;

      const data: WorkflowInfo = {
        repository: fullName,
        id: String(workflow.id ?? key),
        name: typeof workflow.name === "string" ? workflow.name : key,
        path: typeof workflow.path === "string" ? workflow.path : null,
        state: typeof workflow.state === "string" ? workflow.state : null,
        status: typeof last?.status === "string" ? last.status : null,
        lastRunAt:
          typeof last?.updated_at === "string"
            ? last.updated_at
            : typeof last?.created_at === "string"
              ? last.created_at
              : null,
        branch:
          typeof last?.head_branch === "string" ? last.head_branch : null,
        conclusion:
          typeof last?.conclusion === "string" ? last.conclusion : null,
      };
      this.cache.set(cacheKey, data, this.cacheTtlMs);
      return toolOk(data);
    });
  }

  private async searchViaTree(
    repository: string,
    query: string,
    pathPrefix: string | undefined,
    limit: number,
    ref?: string,
  ): Promise<SearchFilesResult["hits"][number][]> {
    const { owner, repo } = parseOwnerRepo(repository);
    let branch = ref?.trim();
    if (!branch) {
      const repoInfo = (await this.client.getJson(
        `/repos/${owner}/${repo}`,
      )) as RepoPayload;
      branch =
        typeof repoInfo.default_branch === "string"
          ? repoInfo.default_branch
          : "main";
    }
    const tree = (await this.client.getJson(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    )) as TreePayload;

    const q = query.toLowerCase();
    const prefix = pathPrefix?.replace(/^\/+/, "").toLowerCase() ?? "";
    const hits: SearchFilesResult["hits"][number][] = [];
    for (const item of tree.tree ?? []) {
      if (item.type !== "blob" || typeof item.path !== "string") {
        continue;
      }
      const path = item.path;
      if (prefix && !path.toLowerCase().startsWith(prefix)) {
        continue;
      }
      const base = path.split("/").pop()?.toLowerCase() ?? "";
      if (base.includes(q) || path.toLowerCase().includes(q)) {
        hits.push({ path });
        if (hits.length >= limit) {
          break;
        }
      }
    }
    return hits;
  }

  private async resolveRepo(explicit?: string): Promise<string> {
    if (explicit?.trim()) {
      return explicit.trim().toLowerCase();
    }
    const resolved = await this.resolver.resolveRepository(this.workspaceId);
    if (!resolved?.trim()) {
      throw new GithubApiRequestError({
        code: ToolErrorCode.NOT_FOUND,
        message: `WorkspaceSourceBinding github ausente para workspace=${this.workspaceId}`,
        details: { workspaceId: this.workspaceId },
      });
    }
    return resolved.trim().toLowerCase();
  }

  /** Ref explicita do caller tem prioridade; senao operationalRef do binding. */
  private async resolveContentRef(explicit?: string): Promise<string | undefined> {
    const trimmed = explicit?.trim();
    if (trimmed) {
      return trimmed;
    }
    if (!this.resolver.resolveOperationalRef) {
      return undefined;
    }
    const operational = await this.resolver.resolveOperationalRef(
      this.workspaceId,
    );
    return operational?.trim() || undefined;
  }

  private async guard<T>(
    toolId: ToolIdType,
    run: () => Promise<ToolResult<T>>,
  ): Promise<ToolResult<T>> {
    try {
      return await run();
    } catch (error) {
      return toolFail(this.toToolError(toolId, error));
    }
  }

  private toToolError(toolId: ToolIdType, error: unknown): ToolError {
    if (error instanceof GithubApiRequestError) {
      return toolError({
        code: error.shape.code,
        message: error.shape.message,
        toolId,
        employeeId: this.employeeId,
        details: {
          workspaceId: this.workspaceId,
          ...error.shape.details,
          status: error.shape.status,
        },
      });
    }
    return toolError({
      code: ToolErrorCode.UNKNOWN,
      message: error instanceof Error ? error.message : "Erro desconhecido",
      toolId,
      employeeId: this.employeeId,
      details: { workspaceId: this.workspaceId },
    });
  }

  private err(
    toolId: ToolIdType,
    code: ToolError["code"],
    message: string,
  ): ToolError {
    return toolError({
      code,
      message,
      toolId,
      employeeId: this.employeeId,
      details: { workspaceId: this.workspaceId },
    });
  }

  private invalid(
    toolId: ToolIdType,
    message: string,
  ): ToolResult<never> {
    return toolFail(this.err(toolId, ToolErrorCode.INVALID_INPUT, message));
  }
}

function normalizeContents(raw: unknown): ContentPayload[] {
  if (Array.isArray(raw)) {
    return raw as ContentPayload[];
  }
  if (raw && typeof raw === "object") {
    return [raw as ContentPayload];
  }
  return [];
}

function mapEntryType(
  type: string | undefined,
): "file" | "dir" | "symlink" | "unknown" {
  if (type === "file") return "file";
  if (type === "dir") return "dir";
  if (type === "symlink") return "symlink";
  return "unknown";
}

type RepoPayload = {
  readonly default_branch?: string;
  readonly description?: string | null;
  readonly language?: string | null;
  readonly pushed_at?: string | null;
  readonly updated_at?: string | null;
};

type ContentPayload = {
  readonly name?: string;
  readonly path?: string;
  readonly type?: string;
  readonly size?: number;
  readonly sha?: string;
  readonly content?: string;
  readonly encoding?: string;
};

type SearchCodePayload = {
  readonly items?: readonly {
    readonly path?: string;
    readonly score?: number;
  }[];
};

type CommitPayload = {
  readonly sha?: string;
  readonly commit?: {
    readonly message?: string;
    readonly author?: { readonly name?: string; readonly date?: string };
  };
  readonly author?: { readonly login?: string };
  readonly files?: readonly {
    readonly filename?: string;
    readonly status?: string;
  }[];
};

type PullPayload = {
  readonly title?: string;
  readonly body?: string | null;
  readonly state?: string;
  readonly draft?: boolean;
  readonly html_url?: string;
  readonly user?: { readonly login?: string };
  readonly base?: { readonly ref?: string };
  readonly head?: { readonly ref?: string };
};

type IssuePayload = {
  readonly title?: string;
  readonly state?: string;
  readonly html_url?: string;
  readonly user?: { readonly login?: string };
  readonly labels?: readonly (string | { readonly name?: string })[];
};

type CommentPayload = {
  readonly id?: number;
  readonly body?: string;
  readonly created_at?: string;
  readonly user?: { readonly login?: string };
};

type WorkflowPayload = {
  readonly id?: number | string;
  readonly name?: string;
  readonly path?: string;
  readonly state?: string;
};

type WorkflowRunsPayload = {
  readonly workflow_runs?: readonly {
    readonly status?: string;
    readonly conclusion?: string | null;
    readonly head_branch?: string | null;
    readonly created_at?: string;
    readonly updated_at?: string;
  }[];
};

type TreePayload = {
  readonly tree?: readonly {
    readonly path?: string;
    readonly type?: string;
  }[];
};

export function createGithubToolPorts(
  options: GitHubToolAdapterOptions,
): ToolPorts {
  return new GitHubToolAdapter(options).asToolPorts();
}
