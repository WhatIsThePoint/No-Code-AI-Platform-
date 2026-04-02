export type TaskStatus = "pending" | "running" | "success" | "failure";

export interface TaskResult {
  task_id: string;
  status: TaskStatus;
  progress_pct: number;
  error_message?: string;
}
