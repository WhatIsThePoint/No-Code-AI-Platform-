import api from "./axios";
import type { TaskResult } from "../types/task";

export const tasksApi = {
  getStatus: (taskId: string) =>
    api.get<TaskResult>(`/tasks/${taskId}/status`),
};
