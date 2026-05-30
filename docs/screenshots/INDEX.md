# Screenshot Inventory — Demo Day 2026-05-29

Captured automatically by `scripts/screenshot_tour.mjs` and
`scripts/screenshot_tour_round2.mjs`.

Free-tier demo account used in §A:
- email `YOussef.nocode@ai.com`
- password `YOussef.nocode@ai.com`
- created via the new email-verification flow (round-trip through MailHog)

Super-admin used in §B:
- `admin@nocode-ai.io` / `Demo1234!` (seed)

---

## §A — Free-tier user (YOussef.nocode@ai.com)

### Authentication & MailHog round-trip

| # | File | What it shows |
|---|---|---|
| 01 | `01_landing.png` | Landing page (hero, three workload cards). |
| 02 | `02_register_empty.png` | Empty Create Account form. |
| 03 | `03_register_filled.png` | Form filled with Youssef NoCode / YOussef.nocode@ai.com. |
| 04 | `04_login_after_register_mailhog_notice.png` | Redirect to Sign In immediately after submit. |
| 05 | `05_mailhog_inbox.png` | **MailHog inbox** showing the freshly-arrived `Verify your No-Code AI account` mail. |
| 06 | `06_mailhog_open_mail.png` | Same as above (mail row clicked). |
| 07 | `07_verify_email_success.png` | `/verify-email?token=…` confirms the account is now active. |
| 08 | `08_login_page.png` | Sign In page (post-verification). |
| 09 | `09_login_filled.png` | Sign In form filled. |
| 32 | `32_after_logout.png` | Sign-out landed back at Sign In with cookies cleared. |

### Workspace tour

| # | File | What it shows |
|---|---|---|
| 10 | `10_dashboard.png` | Authenticated dashboard — Get-started checklist, KPI tiles, FREE chip in the top bar. |
| 11 | `11_datasets_empty.png` | Datasets page (free-tier, no datasets yet). |
| 12 | `12_pipelines_empty.png` | Pipelines page (no pipelines yet). |
| 13 | `13_models_empty.png` | Models page (no model versions yet). |
| 18 | `18_dashboard_get_started.png` | Full-page dashboard capture including KPI tiles + quota panel. |
| 21 | `21_datasets_demo_menu.png` | **Load Demo Dataset** dropdown — Titanic, Iris, etc. |
| 22 | `22_datasets_new_modal.png` | **New Dataset** upload modal. |
| 23 | `23_pipeline_new_dialog.png` | **New Pipeline** dialog — pick ML / GenAI / DL mode. |
| 30 | `30_model_registry_empty.png` | Model Registry page (free-tier view). |
| 31 | `31_collaborator_page.png` | Collaborator page — company workspace switcher. |

### Profile & 2FA opt-in

| # | File | What it shows |
|---|---|---|
| 14 | `14_profile.png` | Profile page — FREE plan card, usage overview, 2FA `NOT ENABLED`. |
| 24 | `24_profile_full.png` | Full-page profile capture. |
| 25 | `25_twofa_enable_modal.png` | **Enable Two-Factor Authentication** modal — QR code + base-32 secret + 6-digit code field. |

### Billing

| # | File | What it shows |
|---|---|---|
| 15 | `15_billing_free_tier.png` | Billing entry from the navbar. |
| 26 | `26_billing_tier_compare.png` | Tier comparison page (Free / Solo / Company). |

### Companion (local Llama 3.2)

| # | File | What it shows |
|---|---|---|
| 19 | `19_companion_drawer_open.png` | Companion drawer opened from the gradient FAB — pre-filled suggestion chips. |
| 20 | `20_companion_question_typed.png` | Sample question typed into the Companion input. |

### Accessibility, i18n, notifications

| # | File | What it shows |
|---|---|---|
| 16 | `16_notifications_dropdown.png` | Notification bell dropdown. |
| 17 | `17_high_contrast_theme.png` | Initial high-contrast toggle preview. |
| 27 | `27_i18n_french_dashboard.png` | **French** translation applied to the dashboard (`Bon retour, Youssef NoCode`). |
| 28 | `28_high_contrast_dashboard.png` | **High-contrast** theme applied to the dashboard. |
| 29 | `29_notifications_bell_open.png` | Bell open over the dashboard. |

---

## §B — Super-admin tour (admin@nocode-ai.io)

| # | File | What it shows |
|---|---|---|
| 33 | `33_admin_landing.png` | Admin console landing (Control room) — no left sidebar. |
| 34 | `34_admin_user_management.png` | **User Management** tab — search, role/tier badges, suspend / impersonate / delete actions. YOussef.nocode@ai.com appears as ACTIVE FREE. |
| 35 | `35_admin_ops_console.png` | **Ops Console** — queue stats, hardware monitor, migration drift panel. |
| 36 | `36_admin_announcements.png` | **Announcements** tab — publish a banner across every tenant. |
| 37 | `37_admin_stats_logs.png` | **Stats & Logs** — audit log of every sensitive action with IP and JSON detail. |

---

## §C — Password reset round-trip (Forgot password → MailHog → new password)

| # | File | What it shows |
|---|---|---|
| 38 | `38_login_with_forgot_link.png` | Sign In page now exposes the **Forgot your password?** link under the password field. |
| 39 | `39_forgot_password_empty.png` | `/forgot-password` — empty form. |
| 40 | `40_forgot_password_filled.png` | Email filled (`YOussef.nocode@ai.com`). |
| 41 | `41_forgot_password_success.png` | Anti-enumeration success card with MailHog hint and 30-minute TTL note. |
| 42 | `42_mailhog_reset_inbox.png` | **MailHog inbox** — `Reset your No-Code AI password` mail visible. |
| 43 | `43_mailhog_reset_mail_body.png` | Same inbox with the mail row clicked (preview pane). |
| 44 | `44_reset_password_form_empty.png` | `/reset-password?token=…` — empty form. |
| 45 | `45_reset_password_form_filled.png` | New password + confirmation filled in. |
| 46 | `46_reset_password_success.png` | Confirmation that the password was updated and every previous session was signed out (refresh tokens revoked). |
| 47 | `47_dashboard_after_password_reset.png` | Sign-in with the new password lands on the dashboard. Tour script then restores the original password so the demo account stays stable. |

The script `scripts/screenshot_password_reset.mjs` always rolls the
password back to the original (`YOussef.nocode@ai.com`) at the end, so
the demo account credentials documented in the project remain valid.

---

## How to regenerate

```bash
# Reset MailHog and clear the demo user
curl -X DELETE http://localhost:8025/api/v1/messages
docker compose exec -T postgres psql -U nocode -d nocode_auth \
  -c "DELETE FROM users WHERE LOWER(email)='youssef.nocode@ai.com';"
rm -rf docs/screenshots/*.png

# Round 1 (auth + MailHog round-trip, free-tier app tour)
node scripts/screenshot_tour.mjs

# Round 2 (Companion, demo dataset, 2FA modal, i18n, admin tour)
node scripts/screenshot_tour_round2.mjs

# Password reset round-trip (forgot/reset + MailHog mail)
node scripts/screenshot_password_reset.mjs
```

Both scripts use the Playwright Chromium already installed in
`~/.cache/ms-playwright/chromium-1223/`. The app must be running at
`http://localhost:5173` and the gateway at `http://localhost:8000`
with MailHog at `http://localhost:8025`.
