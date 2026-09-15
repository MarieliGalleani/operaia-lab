import { prisma } from "@operaia/database";

export interface ConnectionStatus {
  readonly configured: boolean;
  readonly connected: boolean;
  readonly customerId: string | null;
  readonly lastSyncAt: string | null;
  readonly lastError: string | null;
}

export async function getConnectionStatus(clientId: string, configured: boolean): Promise<ConnectionStatus> {
  const connection = await prisma.googleAdsConnection.findUnique({ where: { clientId } });
  return {
    configured,
    connected: Boolean(connection && connection.status === "CONNECTED"),
    customerId: connection?.customerId ?? null,
    lastSyncAt: connection?.lastSyncAt?.toISOString() ?? null,
    lastError: connection?.lastError ?? null,
  };
}

export async function saveConnection(input: {
  clientId: string;
  customerId: string;
  loginCustomerId?: string;
  refreshToken: string;
}): Promise<void> {
  await prisma.googleAdsConnection.upsert({
    where: { clientId: input.clientId },
    create: {
      clientId: input.clientId,
      customerId: input.customerId,
      loginCustomerId: input.loginCustomerId,
      refreshToken: input.refreshToken,
      status: "CONNECTED",
    },
    update: {
      customerId: input.customerId,
      loginCustomerId: input.loginCustomerId,
      refreshToken: input.refreshToken,
      status: "CONNECTED",
      lastError: null,
    },
  });
}

export async function disconnectClient(clientId: string): Promise<void> {
  await prisma.googleAdsConnection.deleteMany({ where: { clientId } });
}

export async function getConnectionOrThrow(clientId: string): Promise<{
  customerId: string;
  loginCustomerId: string | null;
  refreshToken: string;
}> {
  const connection = await prisma.googleAdsConnection.findUnique({ where: { clientId } });
  if (!connection || connection.status !== "CONNECTED") {
    throw new Error("Cliente nao tem conexao ativa com Google Ads.");
  }
  return {
    customerId: connection.customerId,
    loginCustomerId: connection.loginCustomerId,
    refreshToken: connection.refreshToken,
  };
}

export async function markSyncError(clientId: string, message: string): Promise<void> {
  await prisma.googleAdsConnection.updateMany({
    where: { clientId },
    data: { lastError: message },
  });
}

export async function markSyncSuccess(clientId: string): Promise<void> {
  await prisma.googleAdsConnection.updateMany({
    where: { clientId },
    data: { lastSyncAt: new Date(), lastError: null },
  });
}
