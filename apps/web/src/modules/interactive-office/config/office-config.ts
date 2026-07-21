import type { Specialization } from "@/types/office";
import type { OfficeStateId, RoomDef, StateVisual, Tile } from "../types";

export const GRID = { cols: 20, rows: 24 } as const;

/**
 * Identidade OperaIA.lab — paleta própria (índigo executivo + acentos).
 * Usada no piso, paredes e móveis para tornar a captura de tela reconhecível.
 */
export const BRAND = {
  ink: "#1e1b4b",
  primary: "#4f46e5",
  primarySoft: "#e0e7ff",
  floorA: "#eef1fb",
  floorB: "#e6e9f6",
  floorAccent: "#dfe3fa",
  wall: "#d8dcec",
  wallHi: "#eceffb",
  deskTop: "#c9a27a",
  deskLeg: "#8a6a49",
} as const;

/** Um escritório completo: recepção, executiva, reuniões + departamentos + apoio. */
export const ROOMS: readonly RoomDef[] = [
  { id: "reception", label: "Recepção", emoji: "🛎️", kind: "reception", col: 0, row: 0, w: 6, h: 4, tint: "#fef3c7" },
  { id: "executive", label: "Sala da CEO", emoji: "🏛️", kind: "executive", col: 7, row: 0, w: 6, h: 4, tint: "#ede9fe" },
  { id: "meeting", label: "Sala de Reuniões", emoji: "🗣️", kind: "meeting", col: 14, row: 0, w: 6, h: 4, tint: "#f3e8ff" },

  { id: "engineering", label: "Tecnologia", emoji: "🛠️", kind: "department", col: 0, row: 5, w: 6, h: 4, tint: "#e0e7ff" },
  { id: "product", label: "Produto", emoji: "📋", kind: "department", col: 7, row: 5, w: 6, h: 4, tint: "#dbeafe" },
  { id: "design", label: "Design", emoji: "🎨", kind: "department", col: 14, row: 5, w: 6, h: 4, tint: "#fce7f3" },

  { id: "marketing", label: "Marketing", emoji: "📈", kind: "department", col: 0, row: 10, w: 6, h: 4, tint: "#fef3c7" },
  { id: "automation", label: "Automação", emoji: "⚙️", kind: "department", col: 7, row: 10, w: 6, h: 4, tint: "#d1fae5" },
  { id: "commercial", label: "Comercial", emoji: "🤝", kind: "department", col: 14, row: 10, w: 6, h: 4, tint: "#ffedd5" },

  { id: "finance", label: "Financeiro", emoji: "💰", kind: "department", col: 0, row: 15, w: 6, h: 4, tint: "#dcfce7" },
  { id: "legal", label: "Jurídico", emoji: "⚖️", kind: "department", col: 7, row: 15, w: 6, h: 4, tint: "#e2e8f0" },
  { id: "library", label: "Biblioteca", emoji: "📚", kind: "library", col: 14, row: 15, w: 6, h: 4, tint: "#cffafe" },

  { id: "lounge", label: "Área de Descanso", emoji: "☕", kind: "lounge", col: 0, row: 20, w: 6, h: 4, tint: "#fee2e2" },
];

/** Especialidade -> sala (departamento). */
export const ROOM_BY_SPECIALIZATION: Record<Specialization, string> = {
  MANAGEMENT: "executive",
  SOFTWARE_ENGINEERING: "engineering",
  UX_DESIGN: "design",
  PRODUCT: "product",
  MARKETING: "marketing",
  AUTOMATION: "automation",
  FINANCE: "finance",
  LEGAL: "legal",
  COMMERCIAL: "commercial",
};

export const EXECUTIVE_ROOM_ID = "executive";
export const MEETING_ROOM_ID = "meeting";

/** Ferramentas por especialidade (metadado de apresentação da estação). */
export const TOOLS_BY_SPECIALIZATION: Record<Specialization, readonly string[]> = {
  MANAGEMENT: ["Painel executivo", "Relatórios", "Delegação"],
  SOFTWARE_ENGINEERING: ["Arquitetura", "Code Review", "CI/CD"],
  UX_DESIGN: ["Wireframes", "Protótipos", "Design System"],
  PRODUCT: ["Roadmap", "Backlog", "Discovery"],
  AUTOMATION: ["Fluxos", "Integrações", "Webhooks"],
  MARKETING: ["Campanhas", "Conteúdo", "Analytics"],
  FINANCE: ["Fluxo de caixa", "Orçamento", "Projeções"],
  LEGAL: ["Contratos", "Compliance", "Pareceres"],
  COMMERCIAL: ["Pipeline", "Propostas", "CRM"],
};

/** Salas que a fundadora pode "entrar" (abrem painel ao clicar no piso). */
export const CLICKABLE_ROOM_KINDS: ReadonlySet<RoomDef["kind"]> = new Set([
  "department",
  "meeting",
  "library",
  "lounge",
  "reception",
]);

export function roomById(id: string): RoomDef | undefined {
  return ROOMS.find((room) => room.id === id);
}

/** Distribui até N funcionários em slots dentro de uma sala (mini-grade). */
export function slotTile(room: RoomDef, index: number): Tile {
  const perRow = Math.max(1, room.w - 2);
  const col = room.col + 1 + (index % perRow);
  const row = room.row + 1 + Math.floor(index / perRow);
  return {
    col: Math.min(col, room.col + room.w - 1),
    row: Math.min(row, room.row + room.h - 1),
  };
}

/** Centro da sala (para hotspot de clique da sala). */
export function roomCenter(room: RoomDef): Tile {
  return { col: room.col + room.w / 2 - 0.5, row: room.row + room.h / 2 - 0.5 };
}

/** Ponto de "recepção" da sala executiva onde especialistas recebem briefing. */
export function executiveMeetingTile(): Tile {
  const exec = roomById(EXECUTIVE_ROOM_ID)!;
  return { col: exec.col + exec.w - 2, row: exec.row + exec.h - 1 };
}

export const STATE_VISUALS: Record<OfficeStateId, StateVisual> = {
  AVAILABLE: { label: "Disponível", icon: "🟢", color: "#16a34a" },
  THINKING: { label: "Pensando", icon: "🟡", color: "#eab308" },
  ANALYZING: { label: "Analisando", icon: "🔍", color: "#0ea5e9" },
  PLANNING: { label: "Planejando", icon: "🗂️", color: "#8b5cf6" },
  DEVELOPING: { label: "Desenvolvendo", icon: "🔵", color: "#3b82f6" },
  AUTOMATING: { label: "Automatizando", icon: "🟠", color: "#f97316" },
  MEETING: { label: "Em reunião", icon: "🟣", color: "#a855f7" },
  WAITING: { label: "Aguardando", icon: "⏳", color: "#94a3b8" },
  BLOCKED: { label: "Bloqueado", icon: "🔴", color: "#ef4444" },
  OFFLINE: { label: "Offline", icon: "⚪", color: "#cbd5e1" },
};
