/** Cliente do CRUD de ScheduleRule — sem mock, admin-only. */
import { createHttpClient, type HttpClient } from "./http-client";
import type {
  CreateScheduleRuleInput,
  ScheduleRuleDto,
  UpdateScheduleRuleInput,
} from "../schedule-rules";

export interface ScheduleRulesClient {
  list(): Promise<readonly ScheduleRuleDto[]>;
  create(input: CreateScheduleRuleInput): Promise<ScheduleRuleDto>;
  update(id: string, input: UpdateScheduleRuleInput): Promise<ScheduleRuleDto>;
  remove(id: string): Promise<void>;
}

export function createScheduleRulesClient(
  http: HttpClient = createHttpClient(),
): ScheduleRulesClient {
  return {
    list() {
      return http.get<readonly ScheduleRuleDto[]>("/schedule-rules");
    },
    create(input) {
      return http.post<ScheduleRuleDto>("/schedule-rules", input);
    },
    update(id, input) {
      return http.patch<ScheduleRuleDto>(`/schedule-rules/${id}`, input);
    },
    async remove(id) {
      await http.delete<{ deleted: true }>(`/schedule-rules/${id}`);
    },
  };
}

export const scheduleRulesClient = createScheduleRulesClient();
