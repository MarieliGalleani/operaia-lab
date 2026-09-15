/**
 * Financeiro do andar (Carteira de Clientes) — histórico real de pagamentos
 * (setup e recorrência) por cliente, com valor e data, em vez de só um
 * booleano sim/não em Client.setupPaid/recurringActive.
 */
import { prisma } from "@operaia/database";

export type ClientPaymentKind = "SETUP" | "RECORRENTE";

export interface ClientPaymentEntry {
  readonly id: string;
  readonly kind: ClientPaymentKind;
  readonly amountBrl: number;
  readonly paidAt: string;
  readonly note: string | null;
  readonly createdAt: string;
}

interface PaymentRow {
  readonly id: string;
  readonly kind: string;
  readonly amountBrl: number;
  readonly paidAt: Date;
  readonly note: string | null;
  readonly createdAt: Date;
}

function toEntry(row: PaymentRow): ClientPaymentEntry {
  return {
    id: row.id,
    kind: row.kind as ClientPaymentKind,
    amountBrl: row.amountBrl,
    paidAt: row.paidAt.toISOString(),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPayments(clientId: string): Promise<readonly ClientPaymentEntry[]> {
  const rows = await prisma.clientPayment.findMany({
    where: { clientId },
    orderBy: { paidAt: "desc" },
  });
  return rows.map(toEntry);
}

export interface CreatePaymentInput {
  readonly clientId: string;
  readonly kind: ClientPaymentKind;
  readonly amountBrl: number;
  readonly paidAt: string;
  readonly note?: string;
}

export async function createPayment(input: CreatePaymentInput): Promise<ClientPaymentEntry> {
  const row = await prisma.clientPayment.create({
    data: {
      clientId: input.clientId,
      kind: input.kind,
      amountBrl: input.amountBrl,
      paidAt: new Date(input.paidAt),
      note: input.note,
    },
  });
  return toEntry(row);
}

export async function deletePayment(id: string): Promise<void> {
  await prisma.clientPayment.delete({ where: { id } });
}
