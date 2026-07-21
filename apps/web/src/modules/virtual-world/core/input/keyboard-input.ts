/**
 * Fonte de input de teclado (genérica e desacoplada do DOM para testes).
 *
 * Mapeia WASD + setas em um vetor de direção normalizado no espaço de tiles
 * (col/row). Não conhece nenhum conceito de negócio: apenas "qual direção o
 * usuário quer se mover".
 */

/** Direções lógicas de movimento (independentes de layout de teclado). */
export type MoveKey = "up" | "down" | "left" | "right";

/** Vetor de direção no espaço de tiles (col = x, row = y). */
export interface DirectionVector {
  readonly dx: number;
  readonly dy: number;
}

/** Qualquer fonte capaz de informar a direção desejada por frame. */
export interface DirectionalInput {
  getDirection(): DirectionVector;
}

/** code (KeyboardEvent.code) → direção lógica. */
const KEY_MAP: Readonly<Record<string, MoveKey>> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") {
    return false;
  }
  const tag = el.tagName.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

export class KeyboardInput implements DirectionalInput {
  private readonly pressed = new Set<MoveKey>();
  private target: Window | HTMLElement | undefined;

  private readonly onKeyDown = (event: KeyboardEvent): void => this.handle(event, true);
  private readonly onKeyUp = (event: KeyboardEvent): void => this.handle(event, false);

  /** Marca uma direção como pressionada (usado em testes e pelo DOM). */
  press(key: MoveKey): void {
    this.pressed.add(key);
  }

  /** Libera uma direção. */
  release(key: MoveKey): void {
    this.pressed.delete(key);
  }

  clear(): void {
    this.pressed.clear();
  }

  getDirection(): DirectionVector {
    let dx = 0;
    let dy = 0;
    if (this.pressed.has("left")) dx -= 1;
    if (this.pressed.has("right")) dx += 1;
    if (this.pressed.has("up")) dy -= 1;
    if (this.pressed.has("down")) dy += 1;
    if (dx === 0 && dy === 0) {
      return { dx: 0, dy: 0 };
    }
    const length = Math.hypot(dx, dy);
    return { dx: dx / length, dy: dy / length };
  }

  /** Conecta os listeners a uma janela/elemento (no-op fora do browser). */
  attach(target: Window | HTMLElement): void {
    this.detach();
    this.target = target;
    target.addEventListener("keydown", this.onKeyDown as EventListener);
    target.addEventListener("keyup", this.onKeyUp as EventListener);
  }

  detach(): void {
    if (!this.target) {
      return;
    }
    this.target.removeEventListener("keydown", this.onKeyDown as EventListener);
    this.target.removeEventListener("keyup", this.onKeyUp as EventListener);
    this.target = undefined;
    this.pressed.clear();
  }

  private handle(event: KeyboardEvent, isDown: boolean): void {
    if (isDown && isEditableTarget(event.target)) {
      return;
    }
    const move = KEY_MAP[event.code];
    if (!move) {
      return;
    }
    event.preventDefault();
    if (isDown) {
      this.pressed.add(move);
    } else {
      this.pressed.delete(move);
    }
  }
}
