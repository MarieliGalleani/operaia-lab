import type { ChatMessage } from "@/types/office";
import type { OfficeEmployee, OfficeStateId, Tile } from "../types";
import type { MovementEngine } from "./movement-engine";

export interface ScenarioContext {
  engine: MovementEngine;
  meetingTile: Tile;
  getCeo(): OfficeEmployee | undefined;
  findSpecialist(): OfficeEmployee | undefined;
  setState(id: string, state: OfficeStateId): void;
  setCarrying(id: string, value: boolean): void;
  pushEvent(actorId: string, message: string, kind: string): void;
  addCeoMessage(message: ChatMessage): void;
  askExecutive(question: string): Promise<ChatMessage>;
  wait(ms: number): Promise<void>;
}

/**
 * Encena o fluxo executivo visível: Usuário -> CEO -> análise -> delegação ->
 * especialista caminha, recebe briefing, executa e entrega -> CEO responde.
 * É narração do trabalho real (usa askExecutive), não lógica de negócio.
 */
export class ScenarioDirector {
  private token = 0;

  constructor(private readonly ctx: ScenarioContext) {}

  /** Cancela qualquer encenação em andamento. */
  cancel(): void {
    this.token += 1;
  }

  async run(question: string): Promise<void> {
    const local = ++this.token;
    const alive = (): boolean => local === this.token;
    const ctx = this.ctx;

    const ceo = ctx.getCeo();
    const specialist = ctx.findSpecialist();
    if (!ceo) {
      const reply = await ctx.askExecutive(question);
      if (alive()) {
        ctx.addCeoMessage(reply);
      }
      return;
    }

    ctx.setState(ceo.id, "ANALYZING");
    ctx.pushEvent(ceo.id, "iniciou a análise do pedido", "PLAN");

    const replyPromise = ctx.askExecutive(question);
    await ctx.wait(700);
    if (!alive()) {
      return;
    }

    if (specialist) {
      ctx.pushEvent(
        ceo.id,
        `solicitou apoio de ${specialist.role} — ${specialist.name}`,
        "DELEGATION",
      );
      ctx.setCarrying(specialist.id, true);
      ctx.setState(specialist.id, "WAITING");

      await ctx.engine.moveTo(specialist.id, ctx.meetingTile);
      if (!alive()) {
        return;
      }
      ctx.setState(specialist.id, "MEETING");
      ctx.pushEvent(specialist.id, "recebeu o briefing da CEO", "BRIEFING");
      await ctx.wait(900);
      if (!alive()) {
        return;
      }

      await ctx.engine.moveTo(specialist.id, specialist.homeTile);
      if (!alive()) {
        return;
      }
      ctx.setState(specialist.id, "DEVELOPING");
      ctx.pushEvent(specialist.id, "iniciou a execução da tarefa", "TASK");
      await ctx.wait(1700);
      if (!alive()) {
        return;
      }

      ctx.setState(specialist.id, "AVAILABLE");
      await ctx.engine.moveTo(specialist.id, ctx.meetingTile);
      if (!alive()) {
        return;
      }
      ctx.setState(specialist.id, "MEETING");
      ctx.pushEvent(specialist.id, "entregou o resultado à CEO", "REVIEW");
      await ctx.wait(600);
      if (!alive()) {
        return;
      }
    }

    const reply = await replyPromise;
    if (!alive()) {
      return;
    }
    ctx.setState(ceo.id, "AVAILABLE");
    ctx.addCeoMessage(reply);
    ctx.pushEvent(ceo.id, "consolidou o relatório executivo", "REVIEW");

    if (specialist) {
      await ctx.engine.moveTo(specialist.id, specialist.homeTile);
      ctx.setCarrying(specialist.id, false);
      ctx.setState(specialist.id, "AVAILABLE");
    }
  }
}
