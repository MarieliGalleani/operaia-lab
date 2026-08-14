import { afterEach, describe, expect, it } from "vitest";
import {
  assertProofDatabaseIsSafe,
  isOperationalDatabaseUrl,
  isProofSafeDatabaseUrl,
  parseDatabaseName,
  ProofDatabaseUnsafeError,
} from "./assert-proof-database-safe.js";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env.DATABASE_URL = ORIGINAL.DATABASE_URL;
  process.env.OPERAIA_PROOF_ALLOW_OPERATIONAL_DB =
    ORIGINAL.OPERAIA_PROOF_ALLOW_OPERATIONAL_DB;
  process.env.OPERAIA_PROOF_DB_OK = ORIGINAL.OPERAIA_PROOF_DB_OK;
  process.env.OPERAIA_OPERATIONAL_DATABASE_URL =
    ORIGINAL.OPERAIA_OPERATIONAL_DATABASE_URL;
});

describe("assertProofDatabaseIsSafe", () => {
  it("parseDatabaseName extrai nome", () => {
    expect(
      parseDatabaseName(
        "postgresql://USER:PASSWORD@HOST:5432/DATABASE",
      ),
    ).toBe("operaia_lab_test");
  });

  it("banco _test e seguro; operaia_lab e operacional", () => {
    expect(
      isOperationalDatabaseUrl(
        "postgresql://USER:PASSWORD@HOST:5432/DATABASE",
      ),
    ).toBe(true);
    expect(
      isProofSafeDatabaseUrl(
        "postgresql://USER:PASSWORD@HOST:5432/DATABASE",
      ),
    ).toBe(true);
  });

  it("harness com DB seguro → executa", () => {
    process.env.DATABASE_URL =
      "postgresql://USER:PASSWORD@HOST:5432/DATABASE";
    delete process.env.OPERAIA_PROOF_ALLOW_OPERATIONAL_DB;
    expect(() => assertProofDatabaseIsSafe("unit")).not.toThrow();
  });

  it("harness com DATABASE_URL operacional → aborta antes de escrever", () => {
    process.env.DATABASE_URL =
      "postgresql://USER:PASSWORD@HOST:5432/DATABASE";
    delete process.env.OPERAIA_PROOF_ALLOW_OPERATIONAL_DB;
    expect(() => assertProofDatabaseIsSafe("unit")).toThrow(
      ProofDatabaseUnsafeError,
    );
  });

  it("opt-in operacional explicito permite", () => {
    process.env.DATABASE_URL =
      "postgresql://USER:PASSWORD@HOST:5432/DATABASE";
    process.env.OPERAIA_PROOF_ALLOW_OPERATIONAL_DB = "1";
    expect(() => assertProofDatabaseIsSafe("unit")).not.toThrow();
  });
});
