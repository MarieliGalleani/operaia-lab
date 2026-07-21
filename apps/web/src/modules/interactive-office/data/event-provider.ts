import type { OfficeService } from "@/data/office-service";
import { formatTime } from "@/utils/format";
import type { OfficeEvent } from "../types";

/** Mapeia atividades de orquestração para a timeline viva do escritório. */
export class EventProvider {
  constructor(private readonly service: OfficeService) {}

  async load(): Promise<OfficeEvent[]> {
    const activities = await this.service.getActivities();
    return activities.map((activity) => ({
      id: activity.id,
      time: formatTime(activity.timestamp),
      actorId: activity.actorId,
      message: activity.message,
      kind: activity.kind,
    }));
  }
}
