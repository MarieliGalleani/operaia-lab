import { describe, expect, it, vi } from "vitest";
import { MemoryInfrastructureFileSystem } from "./infrastructure-fs.js";
import {
  JournalctlExecError,
  JournalctlInfrastructureLogSource,
  JournalctlUnitNotAllowedError,
  JOURNALCTL_BIN,
  parseJournalctlJsonLines,
  resolveAllowedJournalUnit,
  type JournalctlExec,
} from "./journalctl-infrastructure-log-source.js";

describe("resolveAllowedJournalUnit", () => {
  it("mapeia aliases conhecidos para operaia-lab-api.service", () => {
    expect(resolveAllowedJournalUnit("journal")).toBe(
      "operaia-lab-api.service",
    );
    expect(resolveAllowedJournalUnit("api")).toBe("operaia-lab-api.service");
    expect(resolveAllowedJournalUnit("operaia-lab-api")).toBe(
      "operaia-lab-api.service",
    );
    expect(resolveAllowedJournalUnit("operaia-lab-api.service")).toBe(
      "operaia-lab-api.service",
    );
  });

  it("rejeita unit arbitraria", () => {
    expect(resolveAllowedJournalUnit("ssh.service")).toBeNull();
    expect(resolveAllowedJournalUnit("docker")).toBeNull();
  });
});

describe("parseJournalctlJsonLines", () => {
  it("parseia linhas JSON do journalctl", () => {
    const stdout = [
      JSON.stringify({
        MESSAGE: "api started",
        PRIORITY: "6",
        __REALTIME_TIMESTAMP: "1700000000000000",
      }),
      JSON.stringify({
        MESSAGE: "worker alive",
        PRIORITY: "4",
        __REALTIME_TIMESTAMP: "1700000001000000",
      }),
    ].join("\n");
    const entries = parseJournalctlJsonLines(stdout, 10);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.message).toBe("api started");
    expect(entries[0]?.level).toBe("info");
    expect(entries[1]?.level).toBe("warn");
    expect(entries[0]?.timestamp).toMatch(/^\d{4}-/);
  });
});

describe("JournalctlInfrastructureLogSource", () => {
  it("invoca journalctl com args fixos e allowlist", async () => {
    const exec = vi.fn<JournalctlExec>(async (_file, args) => {
      expect(_file).toBe(JOURNALCTL_BIN);
      expect(args).toEqual([
        "-u",
        "operaia-lab-api.service",
        "-n",
        "2",
        "-o",
        "json",
        "--no-pager",
        "-q",
      ]);
      return {
        stdout: `${JSON.stringify({ MESSAGE: "line-a", PRIORITY: "6" })}\n${JSON.stringify({ MESSAGE: "line-b", PRIORITY: "6" })}\n`,
        stderr: "",
      };
    });

    const source = new JournalctlInfrastructureLogSource(
      new MemoryInfrastructureFileSystem(),
      { exec },
    );
    const entries = await source.readJournal({ unit: "journal", limit: 2 });
    expect(entries).toHaveLength(2);
    expect(entries[1]?.message).toBe("line-b");
    expect(exec).toHaveBeenCalledOnce();
  });

  it("rejeita unit fora da allowlist sem executar", async () => {
    const exec = vi.fn<JournalctlExec>(async () => ({
      stdout: "",
      stderr: "",
    }));
    const source = new JournalctlInfrastructureLogSource(
      new MemoryInfrastructureFileSystem(),
      { exec },
    );
    await expect(
      source.readJournal({ unit: "cron.service", limit: 5 }),
    ).rejects.toBeInstanceOf(JournalctlUnitNotAllowedError);
    expect(exec).not.toHaveBeenCalled();
  });

  it("propaga falha de journalctl (nao mascara com vazio)", async () => {
    const exec = vi.fn<JournalctlExec>(async () => {
      const err = new Error("Command failed") as Error & { stderr: string };
      err.stderr = "No journal files were opened due to insufficient permissions.";
      throw err;
    });
    const source = new JournalctlInfrastructureLogSource(
      new MemoryInfrastructureFileSystem(),
      { exec },
    );
    await expect(
      source.readJournal({ unit: "api", limit: 5 }),
    ).rejects.toBeInstanceOf(JournalctlExecError);
  });

  it("passa --since quando informado", async () => {
    const exec = vi.fn<JournalctlExec>(async (_file, args) => {
      expect(args).toContain("--since");
      expect(args).toContain("2026-01-01 00:00:00");
      return { stdout: "", stderr: "" };
    });
    const source = new JournalctlInfrastructureLogSource(
      new MemoryInfrastructureFileSystem(),
      { exec },
    );
    const entries = await source.readJournal({
      unit: "systemd",
      limit: 1,
      since: "2026-01-01 00:00:00",
    });
    expect(entries).toEqual([]);
  });
});
