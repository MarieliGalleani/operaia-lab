import { computed, ref } from "vue";
import type { ChatMessage } from "@/types/office";
import {
  EXECUTIVE_ROOM_ID,
  executiveMeetingTile,
} from "../config/office-config";
import { createOfficeProvider } from "../data/provider-factory";
import type { InteractiveOfficeProvider } from "../data/office-provider";
import { MovementEngine } from "../engine/movement-engine";
import { ScenarioDirector } from "../engine/scenario-director";
import type {
  OfficeEmployee,
  OfficeEvent,
  OfficeStateId,
  OfficeWorkspace,
} from "../types";

export type Selection =
  | { kind: "executive" }
  | { kind: "employee"; id: string }
  | { kind: "workspace"; id: string }
  | { kind: "room"; id: string }
  | { kind: "map" };

const employees = ref<OfficeEmployee[]>([]);
const workspaces = ref<OfficeWorkspace[]>([]);
const events = ref<OfficeEvent[]>([]);
const messages = ref<ChatMessage[]>([]);
const selection = ref<Selection>({ kind: "map" });
const loading = ref(false);
const loaded = ref(false);
const thinking = ref(false);

let provider: InteractiveOfficeProvider | null = null;
let engine: MovementEngine | null = null;
let director: ScenarioDirector | null = null;
let eventSeq = 0;

function getEmployee(id: string): OfficeEmployee | undefined {
  return employees.value.find((employee) => employee.id === id);
}

function nowTime(): string {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pushEvent(actorId: string, message: string, kind: string): void {
  eventSeq += 1;
  events.value = [
    { id: `ev-live-${eventSeq}`, time: nowTime(), actorId, message, kind },
    ...events.value,
  ];
}

function setState(id: string, state: OfficeStateId): void {
  const employee = getEmployee(id);
  if (employee) {
    employee.state = state;
  }
}

function setCarrying(id: string, value: boolean): void {
  const employee = getEmployee(id);
  if (employee) {
    employee.carryingTask = value;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Estado compartilhado do Interactive Office. Orquestra dados (provider),
 * movimentação (engine) e encenação (director) sem misturar com renderização.
 */
export function useInteractiveOffice() {
  const ceo = computed(() =>
    employees.value.find((employee) => employee.role === "CEO"),
  );

  function findSpecialist(): OfficeEmployee | undefined {
    const hired = employees.value.filter((e) => e.hired && e.role !== "CEO");
    return hired.find((e) => e.role === "CTO") ?? hired[0];
  }

  function ensureEngine(): void {
    if (!provider) {
      provider = createOfficeProvider();
    }
    if (!engine) {
      engine = new MovementEngine(getEmployee);
    }
    if (!director) {
      director = new ScenarioDirector({
        engine,
        meetingTile: executiveMeetingTile(),
        getCeo: () => ceo.value,
        findSpecialist,
        setState,
        setCarrying,
        pushEvent,
        addCeoMessage: (message) => {
          messages.value = [...messages.value, message];
        },
        askExecutive: (question) => provider!.askExecutive(question),
        wait,
      });
    }
  }

  async function load(force = false): Promise<void> {
    if ((loaded.value && !force) || loading.value) {
      return;
    }
    loading.value = true;
    ensureEngine();
    const snapshot = await provider!.load();
    employees.value = snapshot.employees;
    workspaces.value = snapshot.workspaces;
    events.value = snapshot.events;
    loaded.value = true;
    loading.value = false;
  }

  function selectEmployee(id: string): void {
    const employee = getEmployee(id);
    selection.value =
      employee?.role === "CEO"
        ? { kind: "executive" }
        : { kind: "employee", id };
  }

  function selectWorkspace(id: string): void {
    selection.value = { kind: "workspace", id };
  }

  function selectRoom(id: string): void {
    selection.value =
      id === EXECUTIVE_ROOM_ID ? { kind: "executive" } : { kind: "room", id };
  }

  function openExecutive(): void {
    selection.value = { kind: "executive" };
  }

  function closePanel(): void {
    selection.value = { kind: "map" };
  }

  async function sendToCeo(question: string): Promise<void> {
    ensureEngine();
    const trimmed = question.trim();
    if (!trimmed || thinking.value) {
      return;
    }
    messages.value = [
      ...messages.value,
      {
        id: `msg-user-${Date.now()}`,
        author: "user",
        authorName: "Você",
        content: trimmed,
        timestamp: new Date().toISOString(),
      },
    ];
    thinking.value = true;
    try {
      await director!.run(trimmed);
    } finally {
      thinking.value = false;
    }
  }

  return {
    employees,
    workspaces,
    events,
    messages,
    selection,
    loading,
    loaded,
    thinking,
    ceo,
    getEmployee,
    load,
    selectEmployee,
    selectWorkspace,
    selectRoom,
    openExecutive,
    closePanel,
    sendToCeo,
  };
}
