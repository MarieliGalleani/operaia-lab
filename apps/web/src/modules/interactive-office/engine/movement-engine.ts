import type { OfficeEmployee, Tile } from "../types";

export type WaitFn = (ms: number) => Promise<void>;

const defaultWait: WaitFn = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function distance(a: Tile, b: Tile): number {
  return Math.hypot(a.col - b.col, a.row - b.row);
}

/** Caminho em "L" (alinha coluna, depois linha) para parecer caminhada real. */
function waypoints(from: Tile, to: Tile): Tile[] {
  if (from.col === to.col || from.row === to.row) {
    return [{ ...to }];
  }
  return [{ col: to.col, row: from.row }, { ...to }];
}

/**
 * Movimentação pura: define o tile-alvo e a duração; a transição visual é
 * responsabilidade do render (CSS transition). Sem game loop, sem DOM aqui.
 */
export class MovementEngine {
  private readonly versions = new Map<string, number>();

  constructor(
    private readonly getEmployee: (id: string) => OfficeEmployee | undefined,
    private readonly msPerTile = 170,
    private readonly wait: WaitFn = defaultWait,
  ) {}

  isMoving(id: string): boolean {
    return this.getEmployee(id)?.moving ?? false;
  }

  /** Move um funcionário até `target`, resolvendo quando chega (ou for cancelado). */
  async moveTo(id: string, target: Tile): Promise<void> {
    const version = (this.versions.get(id) ?? 0) + 1;
    this.versions.set(id, version);
    const employee = this.getEmployee(id);
    if (!employee) {
      return;
    }

    employee.moving = true;
    const legs = waypoints(employee.tile, target);
    for (const leg of legs) {
      if (this.versions.get(id) !== version) {
        return;
      }
      const ms = Math.max(120, Math.round(distance(employee.tile, leg) * this.msPerTile));
      employee.moveMs = ms;
      employee.tile = { ...leg };
      await this.wait(ms);
    }
    if (this.versions.get(id) === version) {
      employee.moving = false;
    }
  }

  /** Posiciona instantaneamente (sem animação). */
  place(id: string, tile: Tile): void {
    this.versions.set(id, (this.versions.get(id) ?? 0) + 1);
    const employee = this.getEmployee(id);
    if (employee) {
      employee.moving = false;
      employee.moveMs = 0;
      employee.tile = { ...tile };
    }
  }
}
