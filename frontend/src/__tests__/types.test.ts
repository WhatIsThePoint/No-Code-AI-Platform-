import { describe, it, expect } from "vitest";
import type { TaskResult, TaskStatus } from "../types/task";
import type { Pipeline, Algorithm, TaskType } from "../types/pipeline";
import type { ModelVersion } from "../types/model";

describe("TaskResult type", () => {
  it("accepts a valid success result", () => {
    const result: TaskResult = {
      task_id: "abc-123",
      status: "success",
      progress_pct: 100,
      version_id: "v-xyz",
    };
    expect(result.status).toBe("success");
    expect(result.version_id).toBe("v-xyz");
  });

  it("accepts a failure result without version_id", () => {
    const result: TaskResult = {
      task_id: "abc-123",
      status: "failure",
      progress_pct: 42,
      error_message: "something went wrong",
    };
    expect(result.status).toBe("failure");
    expect(result.version_id).toBeUndefined();
  });
});

describe("Pipeline types", () => {
  it("TaskType covers all expected values", () => {
    const types: TaskType[] = ["classification", "regression", "clustering", "forecasting"];
    expect(types).toHaveLength(4);
  });

  it("Algorithm includes regression variants", () => {
    const algs: Algorithm[] = ["xgboost_reg", "random_forest_reg", "ridge", "lightgbm_reg"];
    expect(algs).toHaveLength(4);
  });
});

describe("ModelVersion type", () => {
  it("accepts a classification model version", () => {
    const v: ModelVersion = {
      version_id: "v1",
      pipeline_id: "p1",
      user_id: "u1",
      algorithm: "xgboost",
      task_type: "classification",
      hyperparams: { n_estimators: 100 },
      metrics: { accuracy: 0.95, precision: 0.94, recall: 0.93, f1: 0.935, confusion_matrix: [[50, 2], [3, 45]] },
      artifact_path: "/models/v1.joblib",
      training_duration_s: 12.4,
      created_at: "2026-04-04T10:00:00Z",
    };
    expect(v.algorithm).toBe("xgboost");
  });
});
