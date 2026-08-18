export interface AuthenticatedAdmin {
  readonly id: string;
  readonly login: string;
  readonly role: "ADMIN";
}

export interface AuthUserRecord extends AuthenticatedAdmin {
  readonly passwordHash: string;
  readonly active: boolean;
}

export interface AuthSessionRecord {
  readonly id: string;
  readonly tokenHash: string;
  readonly userId: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

export interface SessionWithUser {
  readonly session: AuthSessionRecord;
  readonly user: AuthUserRecord;
}

export interface CreateSessionInput {
  readonly tokenHash: string;
  readonly userId: string;
  readonly expiresAt: Date;
}

export interface AuthRepository {
  findUserByLogin(login: string): Promise<AuthUserRecord | null>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionWithUser | null>;
  createSession(input: CreateSessionInput): Promise<AuthSessionRecord>;
  revokeSession(tokenHash: string, revokedAt: Date): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}
