# Sprint 6 — Two-Tier Project ACL & Workspace Scoping

This walkthrough covers the three user-facing capabilities shipped in Sprint 6:

1. **Personal vs. Company workspace switching** on the dashboard.
2. **Per-project member assignment** via the new "Manage Access" tab.
3. **Dataset description** field for documenting datasets at upload time.

It also documents the underlying ACL model so an operator (or a future you) can debug a "why is this user getting 403?" question without re-reading the source.

---

## 1. The ACL model in one page

Every pipeline now stores an `owner_type`:

| `owner_type` | Meaning                                                            |
|--------------|--------------------------------------------------------------------|
| `personal`   | Private to the creator. Nobody else, ever, except `super_admin`.   |
| `company`    | Owned by a company. Visibility is governed by `project_members`.   |

The decision tree (resolved by `auth-service` on every request):

```
1. user.role == "super_admin"        → ALLOW (all permissions, every project)
2. owner_type == "personal"           → ALLOW iff user_id == project.user_id
3. user is the company owner          → ALLOW (implicit admin)
4. user has no active company membership → DENY
5. project_members row found          → role determines read / write / manage
6. user is the project creator (no row) → implicit admin
```

Roles inside a company project:

| Role     | read | write | manage_members |
|----------|:----:|:-----:|:--------------:|
| viewer   |  ✓   |       |                |
| editor   |  ✓   |   ✓   |                |
| admin    |  ✓   |   ✓   |       ✓        |

> "Project Manager" in the UI = `role: admin` row in `project_members`.

The `api-gateway` enforces this on every `/pipelines/<id>/...` route via
`require_project_access(permission)` (`services/api-gateway/app/middleware/acl.py`).
On allow, it enriches the upstream call with three authoritative headers:

- `X-User-Id` — JWT subject
- `X-Company-Id` — resolved from `_acl-meta`, **never** from client headers
- `X-Project-Role` — the role the auth-service decided

Any client-supplied `X-User-*` / `X-Company-*` / `X-Project-*` headers are
**stripped** before forwarding (covered by
`tests/test_acl_middleware.py::test_client_supplied_x_user_headers_are_stripped`).

---

## 2. Switching between Personal and Company workspaces

### Where
Dashboard → top-left of the Pipelines section there is a `ToggleButtonGroup`
with two pills: **Personal** and **Company**.

### What it does
- **Personal** filters the pipeline list to `owner_type = "personal"`.
- **Company** filters to `owner_type = "company"` and surfaces a "Company" chip
  on each card.
- The selection is persisted in the dashboard's local state for the session;
  refreshing the page resets to **Personal**.

### Creating a pipeline in either workspace

Click **+ New pipeline**. The dialog now has:

1. A **radio**: *Personal* / *Company*. The *Company* option is hidden if you
   are not a member of any company.
2. When *Company* is chosen, a **member multi-select** appears below it,
   listing every active member of your company. For each picked member you can
   set a default role (Viewer / Editor / Project Manager).

Behind the scenes, the create flow:

1. `POST /pipelines` with `{ name, owner_type, company_id? }` — ml-training
   service writes the Mongo doc.
2. For each picked member, `POST /projects/<pipeline_id>/members` —
   auth-service writes a `project_members` row.

### Personal-to-Company conversion
Not yet exposed in the UI. To convert manually you can:

```bash
docker exec -it no-code-ai-platform--mongo-1 mongosh -u nocode -p nocode_secret \
  --authenticationDatabase admin nocode_ingestion --eval \
  'db.pipelines.updateOne({pipeline_id:"<id>"}, {$set:{owner_type:"company",company_id:"<co-uuid>"}})'
```

A future sprint should wrap this in a button on the editor.

---

## 3. Assigning members to a Company project

### Who sees the Manage Access tab
The tab is rendered on `PipelineEditorPage` only when **all** of these hold:

- The pipeline has `owner_type = "company"` and a `company_id`.
- The current user is one of:
  - the pipeline creator (`pipeline.user_id == me.id`), or
  - `role: super_admin`, or
  - a `role: admin` row in `project_members` for that pipeline.

The frontend uses `projectsApi.listMembers(pipeline_id)` to detect the third
case (`frontend/src/pages/PipelineEditorPage.tsx`).

### Adding a teammate
1. Open the pipeline → click the **Manage Access** tab.
2. In the *Add a teammate* card, pick a teammate from the autocomplete (it
   already filters out users who are members) and pick a role.
3. Click **Add**. The list refreshes with the new row.

### Changing a role
The `Role` column is a `Select` — change the value and the row is updated
in-place via `PUT /projects/<id>/members` (same payload, different role). Only
admins can perform this; non-admins receive a 403 from the auth-service.

### Removing a member
Click the trash icon in the rightmost column. The row is deleted via
`DELETE /projects/<id>/members/<user_id>`. The pipeline creator and the
company owner cannot be removed (the auth-service will return 400 — the UI
surfaces the message in the alert banner).

### Sanity-check from the CLI
```bash
TOKEN="<your access JWT>"
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/projects/<pipeline_id>/members | jq
```

---

## 4. Dataset description field

### What changed
Datasets now carry a free-text `description` (max 2000 chars) stored alongside
the existing metadata in MongoDB.

### Where it shows up
- **Upload form** (`/datasets` → *Upload dataset*) — a multi-line text field
  below the file picker. Optional. Helpful for "what columns mean" or "where
  this came from".
- **Dataset detail page** — the description renders above the schema table.
  Editable in-place by the dataset owner via the pencil icon.

### API
The `POST /datasets/upload` and `PATCH /datasets/<id>` payloads accept an
optional `description: string`. The field is returned on `GET /datasets/<id>`
and `GET /datasets`.

### Why it matters for RAG / pipelines
LLM-driven dataset suggestions in future sprints will consume this description
as part of the system prompt — investing in good descriptions today pays back
when "ask the data" features ship.

---

## 5. Operational notes

### Backfilling existing pipelines

A backfill script tags every pre-Sprint-6 pipeline:

```bash
docker exec -it no-code-ai-platform--ml-training-service-1 \
  python scripts/backfill_owner_type.py
```

Pipelines with a `company_id` become `company`; everything else becomes
`personal`. The script is idempotent.

### Migration

`auth-service` ships an Alembic revision `7e5b3c2a9f30_sprint6_project_members`
that creates the `project_members` table with:

- A `(project_id, user_id)` UNIQUE constraint.
- A CHECK constraint `role IN ('viewer','editor','admin')`.
- Indexes on `project_id`, `user_id`, `company_id`.

It runs automatically on `auth-service` startup via `flask db upgrade`.

### Tests

| Suite                                         | Coverage                                                |
|-----------------------------------------------|---------------------------------------------------------|
| `auth-service/tests/test_project_acl.py`      | 7 tests — decision tree + member CRUD + admin gating    |
| `api-gateway/tests/test_acl_middleware.py`    | 4 tests — deny, allow, 404, header-forgery resistance   |

Run both:
```bash
docker exec no-code-ai-platform--auth-service-1 python -m pytest tests/test_project_acl.py
docker exec no-code-ai-platform--api-gateway-1 python -m pytest tests/test_acl_middleware.py
```

### Common 403s and what they mean

The gateway forwards the auth-service `reason` field verbatim. Most useful
values:

| `reason`                          | Fix                                                      |
|-----------------------------------|----------------------------------------------------------|
| `personal_not_owner`              | The project is private. Convert it or ask the owner.     |
| `no_company_membership`           | User isn't in the company. Invite them first.            |
| `no_project_membership`           | Add a `project_members` row via Manage Access.           |
| `viewer_cannot_write`             | Promote to Editor or Admin.                              |
| `manage_members_requires_admin`   | Promote to Admin (Project Manager).                      |

### Debugging a 503 from /pipelines/...

If the gateway returns `{"error":"upstream_unavailable"}` or
`{"error":"acl_unavailable"}`, the ACL middleware itself failed to reach an
upstream. Check, in order:

1. `docker compose ps` — is `ml-training-service` / `auth-service` actually up?
2. `docker logs no-code-ai-platform--api-gateway-1 --tail 50` — usually shows
   the connect-refused stack.
3. `ML_SERVICE_URL` / `AUTH_SERVICE_URL` env vars in the gateway match the
   docker network hostnames (`ml-training-service:8003`,
   `auth-service:8001`). The Sprint 6 tests now read these from the
   environment so they pass against either local or container hostnames.
