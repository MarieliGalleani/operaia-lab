import type { OfficeService } from "@/data/office-service";
import type { Employee } from "@/types/office";
import { ROOM_BY_SPECIALIZATION, roomById, slotTile } from "../config/office-config";
import type { OfficeEmployee, OfficeStateId } from "../types";

function deriveState(employee: Employee): OfficeStateId {
  if (!employee.active) {
    return "OFFLINE";
  }
  if (employee.status !== "WORKING") {
    return "AVAILABLE";
  }
  if (employee.role === "CEO") {
    return "ANALYZING";
  }
  return employee.specialization === "AUTOMATION" ? "AUTOMATING" : "DEVELOPING";
}

/** Mapeia funcionários do domínio para o escritório vivo (sala + posição + estado). */
export class EmployeeProvider {
  constructor(private readonly service: OfficeService) {}

  async load(): Promise<OfficeEmployee[]> {
    const employees = await this.service.getEmployees();
    const slotCounter = new Map<string, number>();

    return employees.map((employee) => {
      const roomId = ROOM_BY_SPECIALIZATION[employee.specialization];
      const room = roomById(roomId) ?? roomById("executive")!;
      const index = slotCounter.get(roomId) ?? 0;
      slotCounter.set(roomId, index + 1);
      const homeTile = slotTile(room, index);

      return {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        emoji: employee.emoji,
        specialtyLabel: employee.specialtyLabel,
        mission: employee.mission,
        hired: employee.active,
        roomId,
        homeTile,
        tile: { ...homeTile },
        moveMs: 0,
        moving: false,
        state: deriveState(employee),
        carryingTask: false,
        lastActivity: employee.lastActivity,
      };
    });
  }
}
