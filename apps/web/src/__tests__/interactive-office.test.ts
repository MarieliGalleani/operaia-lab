import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/types/office";
import { MovementEngine } from "@/modules/interactive-office/engine/movement-engine";
import { ScenarioDirector } from "@/modules/interactive-office/engine/scenario-director";
import { describeAnimation } from "@/modules/interactive-office/engine/animation-controller";
import { MockProvider } from "@/modules/interactive-office/data/mock-provider";
import { useInteractiveOffice } from "@/modules/interactive-office/composables/useInteractiveOffice";
import type { OfficeEmployee } from "@/modules/interactive-office/types";

const immediate = (): Promise<void> => Promise.resolve();

function employee(id: string, role: string): OfficeEmployee {
  return {
    id,
    name: id,
    role,
    emoji: "🙂",
    specialtyLabel: "—",
    mission: "—",
    hired: true,
    roomId: "engineering",
    homeTile: { col: 4, row: 4 },
    tile: { col: 4, row: 4 },
    moveMs: 0,
    moving: false,
    state: "AVAILABLE",
    carryingTask: false,
    lastActivity: "—",
  };
}

describe("MovementEngine", () => {
  it("caminha até o tile-alvo e encerra o estado moving", async () => {
    const emp = employee("mag", "CTO");
    const engine = new MovementEngine(() => emp, 10, immediate);

    await engine.moveTo("mag", { col: 8, row: 7 });

    expect(emp.tile).toEqual({ col: 8, row: 7 });
    expect(emp.moving).toBe(false);
  });

  it("place posiciona instantaneamente sem animação", () => {
    const emp = employee("mag", "CTO");
    const engine = new MovementEngine(() => emp);
    engine.place("mag", { col: 2, row: 3 });
    expect(emp.tile).toEqual({ col: 2, row: 3 });
    expect(emp.moveMs).toBe(0);
  });
});

describe("ScenarioDirector", () => {
  it("encena delegação: CEO analisa, especialista trabalha e CEO responde", async () => {
    const ceo = employee("opera", "CEO");
    const mag = employee("mag", "CTO");
    const byId = new Map([
      ["opera", ceo],
      ["mag", mag],
    ]);
    const engine = new MovementEngine((id) => byId.get(id), 5, immediate);
    const events: string[] = [];
    const messages: ChatMessage[] = [];
    const reply: ChatMessage = {
      id: "r1",
      author: "ceo",
      authorName: "CEO — Opera",
      content: "Relatório pronto.",
      timestamp: new Date().toISOString(),
    };

    const director = new ScenarioDirector({
      engine,
      meetingTile: { col: 11, row: 3 },
      getCeo: () => ceo,
      findSpecialist: () => mag,
      setState: (id, state) => {
        byId.get(id)!.state = state;
      },
      setCarrying: (id, value) => {
        byId.get(id)!.carryingTask = value;
      },
      pushEvent: (_actor, message) => events.push(message),
      addCeoMessage: (message) => messages.push(message),
      askExecutive: () => Promise.resolve(reply),
      wait: immediate,
    });

    await director.run("Como estão meus projetos?");

    expect(messages).toContain(reply);
    expect(events.some((e) => e.includes("solicitou apoio"))).toBe(true);
    expect(ceo.state).toBe("AVAILABLE");
    expect(mag.state).toBe("AVAILABLE");
    expect(mag.carryingTask).toBe(false);
  });
});

describe("AnimationController", () => {
  it("prioriza a caminhada e liga o monitor ao desenvolver", () => {
    const emp = employee("mag", "CTO");

    emp.moving = true;
    expect(describeAnimation(emp).pose).toBe("walk");
    expect(describeAnimation(emp).monitorOn).toBe(false);

    emp.moving = false;
    emp.state = "DEVELOPING";
    const dev = describeAnimation(emp);
    expect(dev.pose).toBe("type");
    expect(dev.monitorOn).toBe(true);

    emp.state = "OFFLINE";
    expect(describeAnimation(emp).pose).toBe("sleep");
    expect(describeAnimation(emp).monitorOn).toBe(false);
  });
});

describe("Seleção de salas", () => {
  it("selecionar a sala executiva abre a conversa; outra sala abre a sala", () => {
    const office = useInteractiveOffice();

    office.selectRoom("executive");
    expect(office.selection.value.kind).toBe("executive");

    office.selectRoom("meeting");
    expect(office.selection.value).toEqual({ kind: "room", id: "meeting" });
  });
});

describe("MockProvider", () => {
  it("carrega funcionários com sala, posição e estado", async () => {
    const snapshot = await new MockProvider().load();

    expect(snapshot.employees.length).toBeGreaterThan(0);
    const ceo = snapshot.employees.find((e) => e.role === "CEO");
    expect(ceo?.roomId).toBe("executive");
    for (const employeeItem of snapshot.employees) {
      expect(typeof employeeItem.tile.col).toBe("number");
      expect(typeof employeeItem.tile.row).toBe("number");
    }
    expect(snapshot.workspaces.length).toBeGreaterThan(0);
  });
});
