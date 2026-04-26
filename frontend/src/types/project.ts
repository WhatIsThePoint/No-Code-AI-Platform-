export type ProjectRole = "viewer" | "editor" | "admin";

export interface ProjectMember {
  user_id: string;
  email: string;
  full_name: string | null;
  role: ProjectRole;
  granted_by: string | null;
  created_at: string | null;
}
