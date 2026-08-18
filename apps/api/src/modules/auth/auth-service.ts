import type {
  AuthenticatedAdmin,
  AuthRepository,
  PasswordHasher,
} from "./auth.types.js";
import {
  generateSessionToken,
  hashSessionToken,
} from "./session-token.js";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface LoginResult {
  readonly admin: AuthenticatedAdmin;
  readonly sessionToken: string;
  readonly expiresAt: Date;
}

export interface AuthServiceOptions {
  readonly now?: () => Date;
  readonly sessionTtlMs?: number;
}

export class AuthService {
  private readonly now: () => Date;
  private readonly sessionTtlMs: number;

  constructor(
    private readonly repository: AuthRepository,
    private readonly passwordHasher: PasswordHasher,
    options: AuthServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.sessionTtlMs = options.sessionTtlMs ?? SESSION_TTL_MS;
  }

  async login(login: string, password: string): Promise<LoginResult | null> {
    const user = await this.repository.findUserByLogin(normalizeLogin(login));
    if (!user) {
      await this.passwordHasher.hash(password);
      return null;
    }

    let passwordValid = false;
    try {
      passwordValid = await this.passwordHasher.verify(
        user.passwordHash,
        password,
      );
    } catch {
      passwordValid = false;
    }
    if (!passwordValid || !user.active || user.role !== "ADMIN") {
      return null;
    }

    const sessionToken = generateSessionToken();
    const expiresAt = new Date(this.now().getTime() + this.sessionTtlMs);
    await this.repository.createSession({
      tokenHash: hashSessionToken(sessionToken),
      userId: user.id,
      expiresAt,
    });
    return {
      admin: toAuthenticatedAdmin(user),
      sessionToken,
      expiresAt,
    };
  }

  async authenticate(
    sessionToken: string | undefined,
  ): Promise<AuthenticatedAdmin | null> {
    if (!sessionToken) {
      return null;
    }
    const record = await this.repository.findSessionByTokenHash(
      hashSessionToken(sessionToken),
    );
    if (
      !record ||
      record.session.revokedAt ||
      record.session.expiresAt.getTime() <= this.now().getTime() ||
      !record.user.active ||
      record.user.role !== "ADMIN"
    ) {
      return null;
    }
    return toAuthenticatedAdmin(record.user);
  }

  async logout(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) {
      return;
    }
    await this.repository.revokeSession(
      hashSessionToken(sessionToken),
      this.now(),
    );
  }
}

export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

function toAuthenticatedAdmin(input: {
  readonly id: string;
  readonly login: string;
}): AuthenticatedAdmin {
  return { id: input.id, login: input.login, role: "ADMIN" };
}
