import api from "./axios";

export interface CompanionContext {
  active_view?: string;
  pipeline?: {
    name?: string;
    type?: string;
    status?: string;
    /** Summary of the active canvas: node types + counts, e.g. "dataset×1, preprocess×1, train×1". */
    node_summary?: string;
    /** Names of selected/highlighted nodes the user is likely asking about. */
    selected_nodes?: string[];
  } | null;
  dataset?: {
    name?: string;
    row_count?: number;
    column_count?: number;
    /** First ~20 column names + dtype hints, lets the model reference columns by name. */
    schema_preview?: string;
    /** Detected target column if configured in preprocessing. */
    target_column?: string;
  } | null;
  /** Recent errors the user just hit (training failures, upload limits, validation). */
  recent_errors?: string[];
  notes?: string;
}

export interface CompanionAnswer {
  answer: string;
  model: string;
  elapsed_ms: number;
}

export const companionApi = {
  ask: (question: string, context?: CompanionContext) =>
    api.post<CompanionAnswer>("/api/companion/ask", { question, context }),
};
