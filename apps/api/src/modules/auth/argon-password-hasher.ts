import {
  argon2id,
  hash as argonHash,
  verify as argonVerify,
} from "argon2";
import type { PasswordHasher } from "./auth.types.js";

const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export class ArgonPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return argonHash(password, ARGON2_OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return argonVerify(passwordHash, password);
  }
}
