import api from "./axios";
import type { ProjectMember, ProjectRole } from "../types/project";

export const projectsApi = {
  listMembers: (projectId: string) =>
    api.get<{ members: ProjectMember[] }>(`/projects/${projectId}/members`),

  addMember: (
    projectId: string,
    payload: { user_id: string; role: ProjectRole; company_id: string }
  ) =>
    api.post<{ user_id: string; role: ProjectRole; project_id: string }>(
      `/projects/${projectId}/members`,
      payload
    ),

  updateMember: (
    projectId: string,
    payload: { user_id: string; role: ProjectRole; company_id: string }
  ) =>
    api.post<{ user_id: string; role: ProjectRole; project_id: string }>(
      `/projects/${projectId}/members`,
      payload
    ),

  removeMember: (projectId: string, userId: string, companyId: string) =>
    api.delete(`/projects/${projectId}/members/${userId}`, {
      params: { company_id: companyId },
    }),
};
