import { useEffect, useRef, useState } from "react";
import { datasetsApi } from "../api/datasets";
import type { TaskResult, TaskStatus } from "../types/task";

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATES: TaskStatus[] = ["success", "failure"];

export function useTaskStatus(taskId: string | null | undefined) {
  const [result, setResult] = useState<TaskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await datasetsApi.getTaskStatus(taskId);
        if (!cancelled) {
          setResult(data);
          if (!TERMINAL_STATES.includes(data.status)) {
            timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          }
        }
      } catch (e) {
        if (!cancelled) setError("Failed to fetch task status");
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [taskId]);

  return { result, error, isComplete: TERMINAL_STATES.includes(result?.status ?? "pending") };
}
