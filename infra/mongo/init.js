// ============================================================
// No-Code AI Platform — MongoDB Init Script
// Runs inside the mongo container on first startup
// ============================================================

db = db.getSiblingDB("nocode_ingestion");

// ── datasets collection ───────────────────────────────────────────────────────
db.createCollection("datasets");

db.datasets.createIndex({ dataset_id: 1 }, { unique: true });
db.datasets.createIndex({ user_id: 1, created_at: -1 });
db.datasets.createIndex({ company_id: 1, created_at: -1 }, { sparse: true });
db.datasets.createIndex({ status: 1 });

// ── task_results collection ───────────────────────────────────────────────────
db.createCollection("task_results");

db.task_results.createIndex({ task_id: 1 }, { unique: true });
db.task_results.createIndex({ dataset_id: 1 });
db.task_results.createIndex({ pipeline_id: 1 }, { sparse: true });
db.task_results.createIndex({ status: 1 });
// Auto-expire old task results after 7 days
db.task_results.createIndex({ created_at: 1 }, { expireAfterSeconds: 604800 });

// ── pipelines collection ──────────────────────────────────────────────────────
db.createCollection("pipelines");

db.pipelines.createIndex({ pipeline_id: 1 }, { unique: true });
db.pipelines.createIndex({ user_id: 1, created_at: -1 });
db.pipelines.createIndex({ company_id: 1, created_at: -1 }, { sparse: true });
db.pipelines.createIndex({ status: 1 });

// ── model_versions collection ─────────────────────────────────────────────────
db.createCollection("model_versions");

db.model_versions.createIndex({ version_id: 1 }, { unique: true });
db.model_versions.createIndex({ pipeline_id: 1, created_at: -1 });
db.model_versions.createIndex({ user_id: 1, created_at: -1 });

// ── pipeline_step_notes collection ────────────────────────────────────────────
db.createCollection("pipeline_step_notes");

db.pipeline_step_notes.createIndex({ note_id: 1 }, { unique: true });
db.pipeline_step_notes.createIndex({ pipeline_id: 1, node_id: 1, created_at: 1 });

// ── rag_documents collection (Sprint 5 Module 2) ──────────────────────────────
db.createCollection("rag_documents");

db.rag_documents.createIndex({ document_id: 1 }, { unique: true });
db.rag_documents.createIndex({ pipeline_id: 1, created_at: -1 });
db.rag_documents.createIndex({ user_id: 1, created_at: -1 });

print("MongoDB init complete: all collections and indexes created.");
