/**
 * Porta + cliente HTTP para dados basicos de repositorio GitHub.
 * Reutiliza GithubApiClient do @operaia/tool-runtime (unico transporte).
 */
import {
  GithubApiClient,
  parseLastPage,
  type GithubApiClientOptions,
} from "@operaia/tool-runtime";

export interface GithubRepositoryInfo {
  readonly repository: string;
  readonly defaultBranch: string;
  readonly lastCommitSha: string | null;
  readonly primaryLanguage: string | null;
  readonly updatedAt: string;
  readonly openIssuesCount: number;
  readonly openPullRequestsCount: number;
}

export interface GithubRepoClient {
  fetchRepository(repository: string): Promise<GithubRepositoryInfo>;
  /** Arquivos tocados no commit (para decisao operacional). */
  fetchCommitFiles?(
    repository: string,
    sha: string,
  ): Promise<readonly string[]>;
}

export type FetchGithubRepoClientOptions = GithubApiClientOptions & {
  /** Reutiliza instancia existente — nao cria transporte paralelo. */
  readonly client?: GithubApiClient;
};

export class FetchGithubRepoClient implements GithubRepoClient {
  private readonly api: GithubApiClient;

  constructor(options: FetchGithubRepoClientOptions = {}) {
    this.api =
      options.client ??
      new GithubApiClient({
        token: options.token,
        fetchImpl: options.fetchImpl,
        baseUrl: options.baseUrl,
        userAgent: options.userAgent ?? "operaia-lab-github-scanner",
      });
  }

  async fetchRepository(repository: string): Promise<GithubRepositoryInfo> {
    const normalized = repository.trim().toLowerCase();
    const [owner, repo] = normalized.split("/");
    if (!owner || !repo) {
      throw new Error(`repository invalido: ${repository}`);
    }

    const repoJson = (await this.api.getJson(
      `/repos/${owner}/${repo}`,
    )) as RepoPayload;

    const defaultBranch =
      typeof repoJson.default_branch === "string" &&
      repoJson.default_branch.trim()
        ? repoJson.default_branch
        : "main";

    const lastCommitSha = await this.fetchHeadSha(owner, repo, defaultBranch);
    const openPullRequestsCount = await this.fetchOpenPullCount(owner, repo);

    const openIssuesRaw =
      typeof repoJson.open_issues_count === "number"
        ? repoJson.open_issues_count
        : 0;
    const openIssuesCount = Math.max(0, openIssuesRaw - openPullRequestsCount);

    const updatedAt =
      (typeof repoJson.pushed_at === "string" && repoJson.pushed_at) ||
      (typeof repoJson.updated_at === "string" && repoJson.updated_at) ||
      new Date(0).toISOString();

    return {
      repository: normalized,
      defaultBranch,
      lastCommitSha,
      primaryLanguage:
        typeof repoJson.language === "string" ? repoJson.language : null,
      updatedAt,
      openIssuesCount,
      openPullRequestsCount,
    };
  }

  async fetchCommitFiles(
    repository: string,
    sha: string,
  ): Promise<readonly string[]> {
    const normalized = repository.trim().toLowerCase();
    const [owner, repo] = normalized.split("/");
    if (!owner || !repo || !sha.trim()) {
      return [];
    }
    try {
      const commit = (await this.api.getJson(
        `/repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}`,
      )) as CommitDetailPayload;
      const files = Array.isArray(commit.files) ? commit.files : [];
      return files
        .map((file) => file.filename)
        .filter((name): name is string => typeof name === "string");
    } catch {
      return [];
    }
  }

  private async fetchHeadSha(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<string | null> {
    try {
      const commits = (await this.api.getJson(
        `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=1`,
      )) as readonly CommitPayload[];
      const sha = commits[0]?.sha;
      return typeof sha === "string" ? sha : null;
    } catch {
      return null;
    }
  }

  private async fetchOpenPullCount(
    owner: string,
    repo: string,
  ): Promise<number> {
    const path = `/repos/${owner}/${repo}/pulls?state=open&per_page=1`;
    const response = await this.api.request(path);
    if (!response.ok) {
      throw new Error(
        `GitHub pulls ${owner}/${repo}: HTTP ${response.status}`,
      );
    }
    const link = response.headers.get("link") ?? response.headers.get("Link");
    const lastPage = parseLastPage(link);
    if (lastPage !== null) {
      return lastPage;
    }
    const body = (await response.json()) as unknown;
    return Array.isArray(body) ? body.length : 0;
  }
}

type RepoPayload = {
  readonly default_branch?: string;
  readonly language?: string | null;
  readonly open_issues_count?: number;
  readonly pushed_at?: string | null;
  readonly updated_at?: string | null;
};

type CommitPayload = {
  readonly sha?: string;
};

type CommitDetailPayload = {
  readonly files?: readonly { readonly filename?: string }[];
};

export { parseLastPage };
