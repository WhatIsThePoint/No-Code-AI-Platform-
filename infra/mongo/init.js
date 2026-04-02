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
db.task_results.createIndex({ status: 1 });
// Auto-expire old task results after 7 days
db.task_results.createIndex({ created_at: 1 }, { expireAfterSeconds: 604800 });

print("MongoDB init complete: nocode_ingestion collections and indexes created.");
