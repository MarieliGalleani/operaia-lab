import {
  prisma,
  type Session,
  type User,
} from "@operaia/database";
import type {
  AuthRepository,
  AuthSessionRecord,
  AuthUserRecord,
  CreateSessionInput,
  SessionWithUser,
} from "./auth.types.js";

function toUserRecord(user: User): AuthUserRecord {
  return {
    id: user.id,
    login: user.login,
    passwordHash: user.passwordHash,
    role: user.role,
    active: user.active,
  };
}

function toSessionRecord(session: Session): AuthSessionRecord {
  return {
    id: session.id,
    tokenHash: session.tokenHash,
    userId: session.userId,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
  };
}

export class PrismaAuthRepository implements AuthRepository {
  async findUserByLogin(login: string): Promise<AuthUserRecord | null> {
    const user = await prisma.user.findUnique({ where: { login } });
    return user ? toUserRecord(user) : null;
  }

  async findSessionByTokenHash(
    tokenHash: string,
  ): Promise<SessionWithUser | null> {
    const record = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record) {
      return null;
    }
    return {
      session: toSessionRecord(record),
      user: toUserRecord(record.user),
    };
  }

  async createSession(input: CreateSessionInput): Promise<AuthSessionRecord> {
    const session = await prisma.session.create({ data: input });
    return toSessionRecord(session);
  }

  async revokeSession(tokenHash: string, revokedAt: Date): Promise<void> {
    await prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
  }
}
