#!/usr/bin/env python3
"""
Migration drift detector.

Catches the failure class we hit in development: the SQLAlchemy model
declared a new column (or a migration added one) but `infra/postgres/init.sql`
— used by fresh dev volumes — was never updated. Every endpoint that
SELECT-ed from the affected table 500'd until somebody ran `flask db upgrade`
manually.

This script materialises both schemas in throwaway Postgres databases and
prints a structured diff. Intended to run in CI on every PR that touches
`infra/` or `services/auth-service/migrations/`.

Usage
-----

    # In CI (psql + alembic available, ephemeral Postgres reachable):
    python scripts/check_migration_drift.py \
        --pg-host localhost --pg-port 5432 \
        --pg-user nocode --pg-password nocode_secret \
        --init-sql infra/postgres/init.sql \
        --alembic-dir services/auth-service/migrations

    # Locally, against running docker-compose stack (read-only — uses
    # disposable test DBs created in the same Postgres):
    python scripts/check_migration_drift.py --use-running

Exit codes
----------
    0  schemas match (modulo Alembic-only allowlist)
    1  drift detected — diff printed
    2  invocation error (bad arguments / probe failed)
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable

# Tables that legitimately live in Alembic-only land (created by sprint-N
# migrations, never declared in init.sql). The drift detector treats their
# presence in the Alembic schema and absence in init.sql as expected.
ALEMBIC_ONLY_TABLES = {
    "alembic_version",
    "subscriptions",
    "audit_logs",
    "announcements",
    "project_members",
    "rag_documents",
    "rag_chunks",
    "document_chunks",
    "pipeline_messages",
    "meetings",
}


def _run(
    cmd: list[str],
    *,
    env: dict | None = None,
    check: bool = True,
    capture: bool = True,
) -> subprocess.CompletedProcess:
    """Wrapper around subprocess.run that prints failures readably."""
    result = subprocess.run(
        cmd,
        env=env,
        check=False,
        text=True,
        capture_output=capture,
    )
    if check and result.returncode != 0:
        print(f"\n[drift] command failed: {' '.join(cmd)}", file=sys.stderr)
        if result.stdout:
            print("--- stdout ---\n" + result.stdout, file=sys.stderr)
        if result.stderr:
            print("--- stderr ---\n" + result.stderr, file=sys.stderr)
        sys.exit(2)
    return result


def _psql_env(args: argparse.Namespace, db: str) -> dict:
    return {
        **os.environ,
        "PGHOST": args.pg_host,
        "PGPORT": str(args.pg_port),
        "PGUSER": args.pg_user,
        "PGPASSWORD": args.pg_password,
        "PGDATABASE": db,
    }


def _exec_sql(args: argparse.Namespace, db: str, sql: str) -> None:
    """Execute SQL via psql, stdin'd."""
    proc = subprocess.run(
        ["psql", "-v", "ON_ERROR_STOP=1", "-q"],
        input=sql,
        env=_psql_env(args, db),
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        print(f"\n[drift] psql exec failed on db={db}", file=sys.stderr)
        print(proc.stderr, file=sys.stderr)
        sys.exit(2)


@contextmanager
def _temp_db(args: argparse.Namespace, suffix: str):
    """Create a throwaway database, drop it on exit. Connects as superuser to
    the default `postgres` db for management."""
    name = f"_drift_{suffix}_{int(time.time())}"
    _exec_sql(args, "postgres", f'CREATE DATABASE "{name}";')
    try:
        yield name
    finally:
        try:
            _exec_sql(
                args,
                "postgres",
                f"""
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = '{name}' AND pid <> pg_backend_pid();
                DROP DATABASE IF EXISTS "{name}";
                """,
            )
        except SystemExit:
            # Don't mask the original failure with a teardown failure.
            pass


def _dump_schema(args: argparse.Namespace, db: str) -> dict:
    """Return {table_name: {column_name: udt_name}} for every public-schema
    table in the target database."""
    proc = subprocess.run(
        [
            "psql",
            "-At",
            "-F",
            "|",
            "-c",
            (
                "SELECT table_name, column_name, udt_name "
                "FROM information_schema.columns "
                "WHERE table_schema = 'public' "
                "ORDER BY table_name, ordinal_position;"
            ),
        ],
        env=_psql_env(args, db),
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        print(f"\n[drift] schema dump failed on db={db}", file=sys.stderr)
        print(proc.stderr, file=sys.stderr)
        sys.exit(2)

    out: dict[str, dict[str, str]] = {}
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        parts = line.split("|")
        if len(parts) != 3:
            continue
        table, column, udt = parts
        out.setdefault(table, {})[column] = udt
    return out


def _apply_init_sql(args: argparse.Namespace, db: str, init_sql: Path) -> None:
    """Pipe init.sql into a clean target database."""
    proc = subprocess.run(
        ["psql", "-v", "ON_ERROR_STOP=1", "-q", "-f", str(init_sql)],
        env=_psql_env(args, db),
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        print(f"\n[drift] init.sql failed against db={db}", file=sys.stderr)
        print(proc.stderr, file=sys.stderr)
        sys.exit(2)


def _apply_alembic(args: argparse.Namespace, db: str, alembic_dir: Path) -> None:
    """Run `alembic upgrade head` against the throwaway DB."""
    env = {
        **os.environ,
        "DATABASE_URL": (
            f"postgresql://{args.pg_user}:{args.pg_password}@"
            f"{args.pg_host}:{args.pg_port}/{db}"
        ),
    }
    # Alembic's CLI entry point uses the migrations dir as the cwd.
    proc = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=str(alembic_dir),
        env=env,
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        print(f"\n[drift] alembic upgrade failed against db={db}", file=sys.stderr)
        print(proc.stdout + "\n" + proc.stderr, file=sys.stderr)
        sys.exit(2)


def _diff(
    init_schema: dict[str, dict[str, str]],
    alembic_schema: dict[str, dict[str, str]],
) -> dict:
    """Compare the two schemas and return a structured diff."""
    init_tables = set(init_schema)
    alembic_tables = set(alembic_schema)

    only_init = sorted(init_tables - alembic_tables)
    only_alembic = sorted(
        t for t in alembic_tables - init_tables if t not in ALEMBIC_ONLY_TABLES
    )

    column_diffs: list[dict] = []
    for table in sorted(init_tables & alembic_tables):
        init_cols = init_schema[table]
        alembic_cols = alembic_schema[table]
        only_init_cols = sorted(set(init_cols) - set(alembic_cols))
        only_alembic_cols = sorted(set(alembic_cols) - set(init_cols))
        type_mismatches = sorted(
            {
                c
                for c in init_cols
                if c in alembic_cols and init_cols[c] != alembic_cols[c]
            }
        )
        if only_init_cols or only_alembic_cols or type_mismatches:
            column_diffs.append(
                {
                    "table": table,
                    "only_in_init_sql": only_init_cols,
                    "only_in_alembic": only_alembic_cols,
                    "type_mismatches": [
                        {
                            "column": c,
                            "init_sql": init_cols[c],
                            "alembic": alembic_cols[c],
                        }
                        for c in type_mismatches
                    ],
                }
            )

    return {
        "tables_only_in_init_sql": only_init,
        "tables_only_in_alembic": only_alembic,
        "column_diffs": column_diffs,
    }


def _is_clean(diff: dict) -> bool:
    return (
        not diff["tables_only_in_init_sql"]
        and not diff["tables_only_in_alembic"]
        and not diff["column_diffs"]
    )


def _format(diff: dict) -> str:
    lines = ["Migration drift detected:"]
    if diff["tables_only_in_init_sql"]:
        lines.append("\n  Tables only in init.sql (missing from Alembic):")
        for t in diff["tables_only_in_init_sql"]:
            lines.append(f"    - {t}")
    if diff["tables_only_in_alembic"]:
        lines.append(
            "\n  Tables only in Alembic (missing from init.sql,"
            " not on the Alembic-only allowlist):"
        )
        for t in diff["tables_only_in_alembic"]:
            lines.append(f"    - {t}")
    for entry in diff["column_diffs"]:
        lines.append(f"\n  Table: {entry['table']}")
        if entry["only_in_init_sql"]:
            lines.append(
                "    columns only in init.sql:    "
                + ", ".join(entry["only_in_init_sql"])
            )
        if entry["only_in_alembic"]:
            lines.append(
                "    columns only in Alembic:     "
                + ", ".join(entry["only_in_alembic"])
            )
        if entry["type_mismatches"]:
            for tm in entry["type_mismatches"]:
                lines.append(
                    f"    type mismatch: {tm['column']} "
                    f"(init.sql={tm['init_sql']}, alembic={tm['alembic']})"
                )
    return "\n".join(lines)


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Detect schema drift between init.sql and Alembic head.")
    parser.add_argument("--pg-host", default=os.environ.get("PGHOST", "localhost"))
    parser.add_argument(
        "--pg-port", type=int, default=int(os.environ.get("PGPORT", "5432"))
    )
    parser.add_argument("--pg-user", default=os.environ.get("PGUSER", "postgres"))
    parser.add_argument(
        "--pg-password", default=os.environ.get("PGPASSWORD", "postgres")
    )
    parser.add_argument(
        "--init-sql",
        type=Path,
        default=Path("infra/postgres/init.sql"),
        help="Path to the bootstrap SQL file.",
    )
    parser.add_argument(
        "--alembic-dir",
        type=Path,
        default=Path("services/auth-service/migrations"),
        help="Directory containing alembic.ini.",
    )
    parser.add_argument(
        "--json", action="store_true", help="Emit a JSON diff instead of human text."
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    if not args.init_sql.exists():
        print(f"[drift] init.sql not found at {args.init_sql}", file=sys.stderr)
        return 2
    if not (args.alembic_dir / "alembic.ini").exists():
        print(
            f"[drift] alembic.ini not found in {args.alembic_dir}",
            file=sys.stderr,
        )
        return 2

    with _temp_db(args, "init") as init_db, _temp_db(args, "alembic") as alembic_db:
        _apply_init_sql(args, init_db, args.init_sql)
        _apply_alembic(args, alembic_db, args.alembic_dir)
        init_schema = _dump_schema(args, init_db)
        alembic_schema = _dump_schema(args, alembic_db)

    diff = _diff(init_schema, alembic_schema)

    if args.json:
        print(json.dumps(diff, indent=2))
    else:
        if _is_clean(diff):
            print("[drift] OK — init.sql and Alembic head agree.")
        else:
            print(_format(diff))

    return 0 if _is_clean(diff) else 1


if __name__ == "__main__":
    sys.exit(main())
