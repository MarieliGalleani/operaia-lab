import { randomUUID } from "node:crypto";
import type {
  AuthRepository,
  AuthSessionRecord,
  AuthUserRecord,
  CreateSessionInput,
  SessionWithUser,
} from "./auth.types.js";

export class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly sessions = new Map<string, AuthSessionRecord>();

  addUser(
    input: Omit<AuthUserRecord, "id" | "role"> &
      Partial<Pick<AuthUserRecord, "id" | "role">>,
  ): AuthUserRecord {
    const user: AuthUserRecord = {
      id: input.id ?? randomUUID(),
      login: input.login,
      passwordHash: input.passwordHash,
      role: input.role ?? "ADMIN",
      active: input.active,
    };
    this.users.set(user.login, user);
    return user;
  }

  setUserActive(login: string, active: boolean): void {
    const user = this.users.get(login);
    if (user) {
      this.users.set(login, { ...user, active });
    }
  }

  findUserByLogin(login: string): Promise<AuthUserRecord | null> {
    return Promise.resolve(this.users.get(login) ?? null);
  }

  findSessionByTokenHash(
    tokenHash: string,
  ): Promise<SessionWithUser | null> {
    const session = this.sessions.get(tokenHash);
    const user = session ? this.findUserById(session.userId) : null;
    return Promise.resolve(session && user ? { session, user } : null);
  }

  createSession(input: CreateSessionInput): Promise<AuthSessionRecord> {
    const session: AuthSessionRecord = {
      id: randomUUID(),
      tokenHash: input.tokenHash,
      userId: input.userId,
      expiresAt: input.expiresAt,
      revokedAt: null,
    };
    this.sessions.set(session.tokenHash, session);
    return Promise.resolve(session);
  }

  revokeSession(tokenHash: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session && !session.revokedAt) {
      this.sessions.set(tokenHash, { ...session, revokedAt });
    }
    return Promise.resolve();
  }

  listSessionTokenHashes(): readonly string[] {
    return [...this.sessions.keys()];
  }

  private findUserById(userId: string): AuthUserRecord | null {
    return (
      [...this.users.values()].find((user) => user.id === userId) ?? null
    );
  }
}
