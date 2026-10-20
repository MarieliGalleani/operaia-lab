/**
 * Andar 05 · Negócio — importação e leitura das vendas no banco.
 *
 * A análise em si (KPIs, alertas, saúde) é calculada na hora a partir das
 * vendas guardadas (business-analysis.ts), então nunca fica desatualizada
 * em relação ao que está no banco.
 */
import { prisma } from "@operaia/database";
import { analyzeSales, type BusinessAnalysis, type SaleInput } from "./business-analysis.js";
import { parseSalesCsv, type RejectedLine } from "./business-csv.js";

const CHUNK = 1000;
const MAX_REJECTED_KEPT = 50;

export class BusinessImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessImportError";
  }
}

export interface BusinessImportSummary {
  readonly id: string;
  readonly fileName: string;
  readonly rowsReceived: number;
  readonly rowsAccepted: number;
  readonly rowsDuplicated: number;
  readonly rowsRejected: number;
  readonly rejected: readonly RejectedLine[];
  readonly hasCost: boolean;
  readonly salesStored: number;
  readonly createdBy: string | null;
  readonly createdAt: string;
}

interface ImportRow {
  readonly id: string;
  readonly fileName: string;
  readonly rowsReceived: number;
  readonly rowsAccepted: number;
  readonly rowsDuplicated: number;
  readonly rowsRejected: number;
  readonly rejectedJson: unknown;
  readonly hasCost: boolean;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly _count?: { readonly sales: number };
}

function toSummary(row: ImportRow): BusinessImportSummary {
  const rejected = Array.isArray(row.rejectedJson) ? (row.rejectedJson as RejectedLine[]) : [];
  return {
    id: row.id,
    fileName: row.fileName,
    rowsReceived: row.rowsReceived,
    rowsAccepted: row.rowsAccepted,
    rowsDuplicated: row.rowsDuplicated,
    rowsRejected: row.rowsRejected,
    rejected,
    hasCost: row.hasCost,
    salesStored: row._count?.sales ?? row.rowsAccepted,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function importSalesCsv(input: {
  readonly fileName: string;
  readonly csv: string;
  readonly createdBy: string | null;
}): Promise<BusinessImportSummary> {
  const parsed = parseSalesCsv(input.csv);
  if (parsed.fatal) throw new BusinessImportError(parsed.fatal);
  if (parsed.sales.length === 0) {
    const first = parsed.rejected[0];
    throw new BusinessImportError(
      `Nenhuma venda válida na planilha${first ? ` (linha ${first.lineNumber}: ${first.reason})` : ""}.`,
    );
  }

  const created = await prisma.$transaction(
    async (tx) => {
      const imp = await tx.businessImport.create({
        data: {
          fileName: input.fileName.slice(0, 200),
          rowsReceived: parsed.sales.length + parsed.rejected.length,
          rowsRejected: parsed.rejected.length,
          rejectedJson: parsed.rejected.slice(0, MAX_REJECTED_KEPT).map((r) => ({ ...r })),
          hasCost: parsed.hasCost,
          createdBy: input.createdBy,
        },
      });
      let accepted = 0;
      for (let i = 0; i < parsed.sales.length; i += CHUNK) {
        const chunk = parsed.sales.slice(i, i + CHUNK);
        const result = await tx.businessSale.createMany({
          data: chunk.map((s) => ({
            importId: imp.id,
            dedupKey: s.dedupKey,
            occurredOn: new Date(`${s.date}T00:00:00.000Z`),
            customer: s.customer,
            product: s.product,
            revenueBrl: s.revenue,
            costBrl: s.cost,
          })),
          skipDuplicates: true,
        });
        accepted += result.count;
      }
      return tx.businessImport.update({
        where: { id: imp.id },
        data: { rowsAccepted: accepted, rowsDuplicated: parsed.sales.length - accepted },
      });
    },
    { timeout: 60_000 },
  );
  return toSummary(created);
}

export async function listImports(): Promise<readonly BusinessImportSummary[]> {
  const rows = await prisma.businessImport.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { sales: true } } },
  });
  return rows.map(toSummary);
}

/** Apaga a importação e as vendas dela. Retorna false se não existir. */
export async function deleteImport(id: string): Promise<boolean> {
  const result = await prisma.businessImport.deleteMany({ where: { id } });
  return result.count > 0;
}

const TZ = "America/Sao_Paulo";

/** Dia (aaaa-mm-dd) no fuso de São Paulo — pagamento das 22h não muda de dia. */
export function dayInSaoPaulo(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: TZ });
}

export const PAYMENT_KIND_LABEL: Readonly<Record<string, string>> = {
  SETUP: "Setup",
  RECORRENTE: "Mensalidade",
};

export async function loadSpreadsheetSales(): Promise<readonly SaleInput[]> {
  const rows = await prisma.businessSale.findMany({
    select: { occurredOn: true, customer: true, product: true, revenueBrl: true, costBrl: true },
  });
  return rows.map((r) => ({
    date: r.occurredOn.toISOString().slice(0, 10),
    customer: r.customer,
    product: r.product,
    revenue: r.revenueBrl,
    cost: r.costBrl,
  }));
}

export interface CrmSales {
  readonly sales: readonly SaleInput[];
  /** Clientes encerrados (active=false): saída conhecida, não é "risco". */
  readonly inactiveClients: ReadonlySet<string>;
}

/**
 * Recebimentos lançados na Carteira de Clientes (Marketing › Trabalhos).
 * Cada pagamento é uma venda da OperaIA: cliente = nome do cliente,
 * produto = tipo (Setup/Mensalidade) + nicho.
 */
export async function loadCrmSales(): Promise<CrmSales> {
  const rows = await prisma.clientPayment.findMany({
    select: {
      kind: true,
      amountBrl: true,
      paidAt: true,
      client: { select: { name: true, active: true, niche: { select: { name: true } } } },
    },
  });
  const inactive = new Set<string>();
  const sales = rows
    .filter((r) => r.amountBrl > 0)
    .map((r) => {
      if (!r.client.active) inactive.add(r.client.name);
      const kind = PAYMENT_KIND_LABEL[r.kind] ?? r.kind;
      return {
        date: dayInSaoPaulo(r.paidAt),
        customer: r.client.name,
        product: `${kind} · ${r.client.niche.name}`,
        revenue: r.amountBrl,
        cost: null,
      };
    });
  return { sales, inactiveClients: inactive };
}

export interface BusinessDashboard extends BusinessAnalysis {
  readonly importsCount: number;
  readonly lastImportAt: string | null;
  readonly sources: {
    /** Recebimentos da Carteira de Clientes (fonte principal). */
    readonly crmPayments: number;
    /** Vendas vindas de planilha (histórico/extra). */
    readonly spreadsheetSales: number;
  };
}

export async function getDashboard(now: Date = new Date()): Promise<BusinessDashboard> {
  const [crm, sheet, importsCount, last] = await Promise.all([
    loadCrmSales(),
    loadSpreadsheetSales(),
    prisma.businessImport.count(),
    prisma.businessImport.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const sales = [...crm.sales, ...sheet];
  return {
    // Com recebimentos do crm o dado é contínuo: a referência é hoje.
    ...analyzeSales(sales, {
      ...(crm.sales.length > 0 ? { asOf: dayInSaoPaulo(now) } : {}),
      ignoreRiskFor: crm.inactiveClients,
    }),
    importsCount,
    lastImportAt: last ? last.createdAt.toISOString() : null,
    sources: { crmPayments: crm.sales.length, spreadsheetSales: sheet.length },
  };
}
