import { describe, expect, it, vi } from "vitest";
import { createToolContext, ToolErrorCode, ToolId } from "../../index.js";
import { GithubApiClient } from "./github-api-client.js";
import {
  FixedGithubRepositoryResolver,
  type GithubRepositoryResolver,
} from "./github-repository-resolver.js";
import { GitHubToolAdapter, createGithubToolPorts } from "./github-tool-adapter.js";
import { MemoryTtlCache } from "./memory-ttl-cache.js";

type MockRoute = {
  readonly status?: number;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
};

function createMockFetch(routes: Record<string, MockRoute | MockRoute[]>) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string) => {
    const path = url.replace("https://api.github.com", "");
    calls.push(path);
    const entry = routes[path];
    if (!entry) {
      return new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    const route = Array.isArray(entry) ? entry.shift() ?? entry[0] : entry;
    if (!route) {
      return new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(route.body ?? {}), {
      status: route.status ?? 200,
      headers: {
        "Content-Type": "application/json",
        ...(route.headers ?? {}),
      },
    });
  }) as unknown as typeof fetch;

  return { fetchImpl, calls };
}

function createAdapter(
  fetchImpl: typeof fetch,
  cache = new MemoryTtlCache(60_000),
  resolver: GithubRepositoryResolver = new FixedGithubRepositoryResolver(
    "marieligalleani/operaia-core-nexo",
  ),
) {
  const client = new GithubApiClient({
    fetchImpl,
    token: "test-token",
    baseUrl: "https://api.github.com",
  });
  return new GitHubToolAdapter({
    workspaceId: "nexo",
    resolver,
    client,
    cache,
    employeeId: "cto-mag",
  });
}

describe("GitHubToolAdapter", () => {
  it("readRepository resolve workspace → owner/repo", async () => {
    const { fetchImpl, calls } = createMockFetch({
      "/repos/marieligalleani/operaia-core-nexo": {
        body: {
          default_branch: "main",
          description: "NEXO core",
          language: "TypeScript",
          updated_at: "2026-07-30T12:00:00Z",
          pushed_at: "2026-07-30T12:00:00Z",
        },
      },
    });
    const adapter = createAdapter(fetchImpl);
    const result = await adapter.readRepository({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.owner).toBe("marieligalleani");
      expect(result.data.name).toBe("operaia-core-nexo");
      expect(result.data.defaultBranch).toBe("main");
      expect(result.data.primaryLanguage).toBe("TypeScript");
    }
    expect(calls[0]).toContain("/repos/marieligalleani/operaia-core-nexo");
  });

  it("listDirectory usa operationalRef quando caller nao informa ref", async () => {
    const { fetchImpl, calls } = createMockFetch({
      "/repos/marieligalleani/operaia-lab/contents?ref=lab": {
        body: [{ name: "finance", path: "finance", type: "dir", size: 0 }],
      },
    });
    const resolver: GithubRepositoryResolver = {
      resolveRepository: async () => "marieligalleani/operaia-lab",
      resolveOperationalRef: async () => "lab",
    };
    const client = new GithubApiClient({
      fetchImpl,
      token: "test-token",
      baseUrl: "https://api.github.com",
    });
    const adapter = new GitHubToolAdapter({
      workspaceId: "operaia-lab",
      resolver,
      client,
      employeeId: "aurora",
    });
    const result = await adapter.listDirectory({});
    expect(result.ok).toBe(true);
    expect(calls.some((path) => path.includes("ref=lab"))).toBe(true);
  });

  it("searchFiles tree fallback usa operationalRef", async () => {
    const calls: string[] = [];
    const flexible = vi.fn(async (url: string) => {
      const path = url.replace("https://api.github.com", "");
      calls.push(path);
      if (url.includes("/search/code")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/git/trees/lab")) {
        return new Response(
          JSON.stringify({
            tree: [{ path: "finance/overview.md", type: "blob" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
      });
    }) as unknown as typeof fetch;

    const resolver: GithubRepositoryResolver = {
      resolveRepository: async () => "marieligalleani/operaia-lab",
      resolveOperationalRef: async () => "lab",
    };
    const adapter = createAdapter(flexible, new MemoryTtlCache(60_000), resolver);
    const result = await adapter.searchFiles({ query: "overview" });
    expect(result.ok).toBe(true);
    expect(calls.some((path) => path.includes("/git/trees/lab"))).toBe(true);
    if (result.ok) {
      expect(
        result.data.hits.some((hit) => hit.path === "finance/overview.md"),
      ).toBe(true);
    }
  });

  it("listDirectory retorna arquivos e dirs com size", async () => {
    const { fetchImpl } = createMockFetch({
      "/repos/marieligalleani/operaia-core-nexo/contents": {
        body: [
          { name: "src", path: "src", type: "dir", size: 0 },
          { name: "README.md", path: "README.md", type: "file", size: 120 },
        ],
      },
    });
    const adapter = createAdapter(fetchImpl);
    const result = await adapter.listDirectory({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "src", type: "dir" }),
          expect.objectContaining({
            name: "README.md",
            type: "file",
            size: 120,
          }),
        ]),
      );
    }
  });

  it("readFile retorna conteudo + sha + size", async () => {
    const content = Buffer.from("export const x = 1;\n").toString("base64");
    const flexibleFetch = vi.fn(async (url: string) => {
      if (url.includes("/contents/")) {
        return new Response(
          JSON.stringify({
            path: "src/a.ts",
            type: "file",
            encoding: "base64",
            content,
            size: 19,
            sha: "abc123",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
      });
    }) as unknown as typeof fetch;

    const adapter = createAdapter(flexibleFetch);
    const result = await adapter.readFile({ path: "src/a.ts" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.content).toContain("export const x");
      expect(result.data.sha).toBe("abc123");
      expect(result.data.size).toBe(19);
    }
  });

  it("searchFiles por nome/caminho (tree fallback)", async () => {
    const flexible = vi.fn(async (url: string) => {
      if (url.includes("/search/code")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/repos/marieligalleani/operaia-core-nexo")) {
        return new Response(JSON.stringify({ default_branch: "main" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/git/trees/")) {
        return new Response(
          JSON.stringify({
            tree: [
              { path: "apps/api/src/foo.ts", type: "blob" },
              { path: "README.md", type: "blob" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
      });
    }) as unknown as typeof fetch;

    const adapter = createAdapter(flexible);
    const result = await adapter.searchFiles({ query: "foo" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hits.some((hit) => hit.path.includes("foo.ts"))).toBe(
        true,
      );
    }
  });

  it("readCommit retorna autor, mensagem e arquivos", async () => {
    const flexible = vi.fn(async (url: string) => {
      if (url.includes("/commits/sha1")) {
        return new Response(
          JSON.stringify({
            sha: "sha1",
            commit: {
              message: "fix: bug",
              author: { name: "Dev", date: "2026-07-30T10:00:00Z" },
            },
            author: { login: "dev" },
            files: [
              { filename: "src/a.ts", status: "modified" },
              { filename: "src/b.ts", status: "added" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const adapter = createAdapter(flexible);
    const result = await adapter.readCommit({ sha: "sha1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.authorLogin).toBe("dev");
      expect(result.data.message).toBe("fix: bug");
      expect(result.data.files).toEqual(["src/a.ts", "src/b.ts"]);
      expect(result.data.fileChanges[0]?.status).toBe("modified");
    }
  });

  it("readPullRequest retorna titulo, commits e arquivos", async () => {
    const flexible = vi.fn(async (url: string) => {
      if (url.endsWith("/pulls/7")) {
        return new Response(
          JSON.stringify({
            title: "Add feature",
            body: "desc",
            state: "open",
            draft: false,
            html_url: "https://github.com/x/y/pull/7",
            user: { login: "dev" },
            base: { ref: "main" },
            head: { ref: "feat" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/pulls/7/commits")) {
        return new Response(JSON.stringify([{ sha: "c1" }, { sha: "c2" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/pulls/7/files")) {
        return new Response(
          JSON.stringify([{ filename: "a.ts" }, { filename: "b.ts" }]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const adapter = createAdapter(flexible);
    const result = await adapter.readPullRequest({ number: 7 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Add feature");
      expect(result.data.description).toBe("desc");
      expect(result.data.commits).toEqual(["c1", "c2"]);
      expect(result.data.files).toEqual(["a.ts", "b.ts"]);
    }
  });

  it("readIssue retorna labels e comentarios", async () => {
    const flexible = vi.fn(async (url: string) => {
      if (url.endsWith("/issues/3") && !url.includes("comments")) {
        return new Response(
          JSON.stringify({
            title: "Bug",
            state: "open",
            html_url: "https://github.com/x/y/issues/3",
            user: { login: "alice" },
            labels: [{ name: "critical" }, "bug"],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/issues/3/comments")) {
        return new Response(
          JSON.stringify([
            {
              id: 1,
              body: "looking",
              created_at: "2026-07-30T11:00:00Z",
              user: { login: "bob" },
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const adapter = createAdapter(flexible);
    const result = await adapter.readIssue({ number: 3 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.labels).toEqual(
        expect.arrayContaining(["critical", "bug"]),
      );
      expect(result.data.comments[0]?.authorLogin).toBe("bob");
    }
  });

  it("readWorkflow retorna status e conclusao da ultima execucao", async () => {
    const flexible = vi.fn(async (url: string) => {
      if (url.includes("/actions/workflows/ci.yml") && !url.includes("/runs")) {
        return new Response(
          JSON.stringify({
            id: 99,
            name: "CI",
            path: ".github/workflows/ci.yml",
            state: "active",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/runs")) {
        return new Response(
          JSON.stringify({
            workflow_runs: [
              {
                status: "completed",
                conclusion: "success",
                head_branch: "main",
                updated_at: "2026-07-30T12:00:00Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const adapter = createAdapter(flexible);
    const result = await adapter.readWorkflow({
      workflowIdOrPath: "ci.yml",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("completed");
      expect(result.data.conclusion).toBe("success");
      expect(result.data.branch).toBe("main");
    }
  });

  it("cache evita segunda chamada HTTP em 60s", async () => {
    let hits = 0;
    const flexible = vi.fn(async () => {
      hits += 1;
      return new Response(
        JSON.stringify({
          default_branch: "main",
          description: "x",
          language: "TS",
          updated_at: "2026-07-30T12:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const cache = new MemoryTtlCache(60_000);
    const adapter = createAdapter(flexible, cache);
    await adapter.readRepository({});
    await adapter.readRepository({});
    expect(hits).toBe(1);
  });

  it("erros HTTP viram ToolResult (nunca throw)", async () => {
    const flexible = vi.fn(async () => {
      return new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const adapter = createAdapter(flexible);
    const result = await adapter.readFile({ path: "missing.ts" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ToolErrorCode.NOT_FOUND);
    }
  });

  it("RATE_LIMIT e UNAUTHORIZED padronizados", async () => {
    const rate = vi.fn(async () => {
      return new Response(JSON.stringify({ message: "API rate limit" }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "x-ratelimit-remaining": "0",
        },
      });
    }) as unknown as typeof fetch;
    const unauthorized = vi.fn(async () => {
      return new Response(JSON.stringify({ message: "Bad credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const r1 = await createAdapter(rate).readRepository({});
    const r2 = await createAdapter(unauthorized).readRepository({});
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (!r1.ok) expect(r1.error.code).toBe(ToolErrorCode.RATE_LIMIT);
    if (!r2.ok) expect(r2.error.code).toBe(ToolErrorCode.UNAUTHORIZED);
  });

  it("ToolContext + permission: Mag le file; Atlas negado", async () => {
    const flexible = vi.fn(async (url: string) => {
      if (url.includes("/contents/")) {
        return new Response(
          JSON.stringify({
            path: "a.ts",
            type: "file",
            encoding: "base64",
            content: Buffer.from("ok").toString("base64"),
            size: 2,
            sha: "s",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const ports = createGithubToolPorts({
      workspaceId: "nexo",
      resolver: new FixedGithubRepositoryResolver("acme/nexo"),
      clientOptions: { fetchImpl: flexible, token: "t" },
      employeeId: "cto-mag",
    });

    const mag = createToolContext({ employeeId: "cto-mag", ports });
    const atlas = createToolContext({ employeeId: "atlas", ports });

    const ok = await mag.readFile({ path: "a.ts" });
    const denied = await atlas.readFile({ path: "a.ts" });
    expect(ok.ok).toBe(true);
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe(ToolErrorCode.PERMISSION_DENIED);
    }
    expect(mag.canUse(ToolId.readIssue)).toBe(true);
  });

  it("binding ausente → NOT_FOUND sem exception", async () => {
    const adapter = new GitHubToolAdapter({
      workspaceId: "orphan",
      resolver: { resolveRepository: async () => null },
      clientOptions: {
        fetchImpl: vi.fn() as unknown as typeof fetch,
      },
    });
    const result = await adapter.readRepository({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ToolErrorCode.NOT_FOUND);
    }
  });
});
