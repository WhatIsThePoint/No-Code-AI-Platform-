"""One-shot: stamp owner_type onto existing pipeline documents in Mongo.

Rule:
  - docs with company_id set     → owner_type = 'company'
  - everything else              → owner_type = 'personal'

Re-running is idempotent: docs that already have owner_type are skipped.

Usage (inside the ml-training-service container):
    python -m scripts.backfill_owner_type
"""

from __future__ import annotations

import os
import sys

from pymongo import MongoClient


def main() -> int:
    uri = os.environ.get("MONGO_URL") or os.environ.get("MONGO_URI")
    if not uri:
        print("[backfill] MONGO_URL/MONGO_URI not set", file=sys.stderr)
        return 1
    client = MongoClient(uri)
    db_name = os.environ.get("MONGO_DB")
    db = client[db_name] if db_name else client.get_default_database()
    col = db["pipelines"]

    total = col.count_documents({})
    missing = col.count_documents({"owner_type": {"$exists": False}})
    print(f"[backfill] total pipelines: {total}, missing owner_type: {missing}")

    if missing == 0:
        print("[backfill] nothing to do.")
        return 0

    company_result = col.update_many(
        {"owner_type": {"$exists": False}, "company_id": {"$ne": None}},
        {"$set": {"owner_type": "company"}},
    )
    personal_result = col.update_many(
        {"owner_type": {"$exists": False}},
        {"$set": {"owner_type": "personal"}},
    )

    print(
        "[backfill] tagged company=%d personal=%d"
        % (company_result.modified_count, personal_result.modified_count)
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
