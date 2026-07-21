import type { OfficeService } from "@/data/office-service";
import type { OfficeWorkspace } from "../types";

const PROJECT_EMOJI: Record<string, string> = {
  nexo: "🚀",
  menuflow: "🍽",
  plataforma: "🎨",
};

/** Mapeia workspaces do domínio para "salas de projeto" do escritório. */
export class WorkspaceProvider {
  constructor(private readonly service: OfficeService) {}

  async load(): Promise<OfficeWorkspace[]> {
    const projects = await this.service.getProjects();
    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      emoji: PROJECT_EMOJI[project.id] ?? "📦",
      objective: project.objective,
      status: project.status,
      progress: project.progress,
      roomId: `project-${project.id}`,
      teamIds: project.teamIds,
    }));
  }
}
