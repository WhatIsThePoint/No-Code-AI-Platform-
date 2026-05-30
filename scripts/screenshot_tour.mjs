/**
 * Demo Day Screenshot Tour
 * Walks the full app as the free-tier user YOussef.nocode@ai.com
 * Saves PNGs into docs/screenshots/
 *
 * Run: node scripts/screenshot_tour.mjs
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import quopri from "quoted-printable";
import utf8 from "utf8";

const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const APP = "http://localhost:5173";
const GW = "http://localhost:8000";
const MH = "http://localhost:8025";
const EMAIL = "YOussef.nocode@ai.com";
const PASSWORD = "YOussef.nocode@ai.com";
const FULL_NAME = "Youssef NoCode";

const log = (m) => console.log(`▸ ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function snap(page, name, opts = {}) {
  const fp = path.join(OUT, `${String(counter).padStart(2, "0")}_${name}.png`);
  await page.screenshot({ path: fp, fullPage: opts.fullPage ?? false });
  log(`📸 ${fp}`);
  counter += 1;
}
let counter = 1;

function clearMailHog() {
  try {
    execSync(`curl -sf -X DELETE ${MH}/api/v1/messages`);
  } catch {}
}

async function pullVerificationToken() {
  const out = execSync(`curl -sf ${MH}/api/v2/messages`).toString();
  const j = JSON.parse(out);
  if (!j.items || !j.items.length) throw new Error("MailHog empty");
  const body = j.items[0].Content.Body;
  // Decode quoted-printable then utf-8.
  const decoded = utf8.decode(quopri.decode(body));
  const m = decoded.match(/token=([A-Za-z0-9_\-]+)/);
  if (!m) throw new Error("token not found in mail body");
  return m[1];
}

async function safeClick(page, selector, { timeout = 3000 } = {}) {
  try {
    await page.click(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

(async () => {
  clearMailHog();

  // Make sure the demo account does not exist yet.
  try {
    execSync(
      `docker compose exec -T postgres psql -U nocode -d nocode_auth -c "DELETE FROM users WHERE email='${EMAIL.toLowerCase()}';" 2>/dev/null`,
    );
  } catch {}

  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      `${process.env.HOME}/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`,
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  try {
    // ───────────────────── 01 — Landing ─────────────────────
    log("Landing");
    await page.goto(APP, { waitUntil: "networkidle" });
    await sleep(500);
    await snap(page, "landing", { fullPage: true });

    // ───────────────────── 02 — Register page (empty) ──────
    log("Register page");
    await page.goto(`${APP}/register`, { waitUntil: "networkidle" });
    await sleep(400);
    await snap(page, "register_empty");

    // ───────────────────── 03 — Register page (filled) ─────
    log("Register form filled");
    await page.fill('input[name="full_name"]', FULL_NAME);
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await snap(page, "register_filled");

    // Submit registration. React-hook-form + MUI Controller can be finicky about
    // committing the Select default before submission. We trigger the Select
    // open-then-pick to make sure the form is valid.
    log("Submit register");
    await page.click("text=Create Account", { timeout: 4000 }).catch(() => {});
    // Backup: hit the submit button if the named click missed.
    await page.click('button[type="submit"]').catch(() => {});
    try {
      await page.waitForURL("**/login**", { timeout: 12000 });
    } catch {
      // If we did not redirect, screenshot the page so we can see what went wrong.
      await snap(page, "register_after_submit_no_redirect");
      // Try once more, in case validation now passes after a re-render.
      await page.click('button[type="submit"]').catch(() => {});
      await page.waitForURL("**/login**", { timeout: 12000 });
    }
    await sleep(700);
    await snap(page, "login_after_register_mailhog_notice");

    // ───────────────────── 04 — MailHog inbox ──────────────
    log("MailHog inbox");
    const mhPage = await ctx.newPage();
    await mhPage.goto(MH, { waitUntil: "networkidle" });
    await sleep(800);
    await mhPage.screenshot({
      path: path.join(OUT, `${String(counter).padStart(2, "0")}_mailhog_inbox.png`),
    });
    log(`📸 ${path.join(OUT, `${counter}_mailhog_inbox.png`)}`);
    counter += 1;

    // Click the first message
    log("MailHog open mail");
    await mhPage
      .locator(".messages .row, .msglist-message, .row")
      .first()
      .click({ timeout: 4000 })
      .catch(() => {});
    await sleep(600);
    await mhPage.screenshot({
      path: path.join(OUT, `${String(counter).padStart(2, "0")}_mailhog_open_mail.png`),
    });
    counter += 1;
    await mhPage.close();

    // ───────────────────── 05 — Verify page ────────────────
    log("Pull token and visit /verify-email");
    const token = await pullVerificationToken();
    log(`token=${token.slice(0, 12)}…`);
    // Sanity: hit the API directly first so any cookie/CORS issue surfaces here.
    const apiResp = await page.evaluate(async (t) => {
      const r = await fetch("/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      return { status: r.status, body: await r.text() };
    }, token);
    log(`verify API → ${apiResp.status} ${apiResp.body}`);
    // Re-request a fresh token (the one above just consumed it).
    await page.evaluate(
      async (email) => {
        await fetch("/auth/resend-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      },
      EMAIL,
    );
    await sleep(500);
    const token2 = await pullVerificationToken();
    log(`fresh token=${token2.slice(0, 12)}…`);
    await page.goto(`${APP}/verify-email?token=${token2}`, {
      waitUntil: "networkidle",
    });
    try {
      await page.waitForSelector("text=Email verified", { timeout: 8000 });
    } catch {
      await snap(page, "verify_email_state");
      throw new Error("verify page did not show success");
    }
    await snap(page, "verify_email_success");

    // ───────────────────── 06 — Login flow ─────────────────
    log("Login as YOussef.nocode");
    await page.goto(`${APP}/login`, { waitUntil: "networkidle" });
    await sleep(300);
    await snap(page, "login_page");

    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await snap(page, "login_filled");
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.toString().endsWith("/login"), {
      timeout: 8000,
    });
    await sleep(900);

    // ───────────────────── 07 — Dashboard ──────────────────
    log("Dashboard");
    await snap(page, "dashboard", { fullPage: true });

    // ───────────────────── 08 — Datasets page ──────────────
    log("Datasets");
    await page.goto(`${APP}/data`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(700);
    await snap(page, "datasets_empty", { fullPage: true });

    // ───────────────────── 09 — Pipelines page ─────────────
    log("Pipelines");
    await page.goto(`${APP}/pipelines`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(700);
    await snap(page, "pipelines_empty", { fullPage: true });

    // ───────────────────── 10 — Models page ────────────────
    log("Models");
    await page.goto(`${APP}/models`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(700);
    await snap(page, "models_empty", { fullPage: true });

    // ───────────────────── 11 — Profile ────────────────────
    log("Profile");
    await page.goto(`${APP}/profile`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(700);
    await snap(page, "profile", { fullPage: true });

    // ───────────────────── 12 — Billing ────────────────────
    log("Billing");
    await page.goto(`${APP}/billing`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(900);
    await snap(page, "billing_free_tier", { fullPage: true });

    // ───────────────────── 13 — Companion FAB ──────────────
    log("Companion FAB");
    await page.goto(`${APP}/dashboard`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(800);
    const opened = await safeClick(
      page,
      'button[aria-label="Open AI Companion"], button[aria-label*="Companion"], button:has-text("Companion")',
    );
    if (opened) {
      await sleep(700);
      await snap(page, "companion_drawer", { fullPage: false });
    } else {
      log("Companion FAB not found, skipping");
    }

    // ───────────────────── 14 — Notification bell ──────────
    log("Notification bell");
    const bell = await safeClick(
      page,
      'button[aria-label*="otification"], button[aria-label="Notifications"]',
    );
    if (bell) {
      await sleep(500);
      await snap(page, "notifications_dropdown");
      await page.keyboard.press("Escape").catch(() => {});
    }

    // ───────────────────── 15 — Language toggle (FR) ───────
    log("Language toggle FR");
    const langBtn = await safeClick(
      page,
      'button[aria-label*="anguage"], button[title*="anguage"], button:has-text("EN")',
    );
    if (langBtn) {
      await sleep(400);
      const frOpt = await safeClick(
        page,
        'li:has-text("Français"), [role="menuitem"]:has-text("Français")',
      );
      if (frOpt) {
        await sleep(700);
        await snap(page, "i18n_french");
      }
    }

    // Switch back to English
    await safeClick(
      page,
      'button[aria-label*="anguage"], button[title*="anguage"], button:has-text("FR")',
    );
    await sleep(300);
    await safeClick(
      page,
      'li:has-text("English"), [role="menuitem"]:has-text("English")',
    );

    // ───────────────────── 16 — High-contrast theme ────────
    log("High-contrast theme");
    const contrastBtn = await safeClick(
      page,
      'button[aria-label*="ontrast"], button[title*="ontrast"], button[aria-label*="theme"]',
    );
    if (contrastBtn) {
      await sleep(500);
      await snap(page, "high_contrast_theme");
      await safeClick(
        page,
        'button[aria-label*="ontrast"], button[aria-label*="theme"]',
      );
    }

    // ───────────────────── 17 — Pipeline new (ML) ──────────
    log("New pipeline → ML mode");
    await page.goto(`${APP}/pipelines`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(500);
    const newPipe = await safeClick(
      page,
      'button:has-text("New Pipeline"), button:has-text("Create"), button:has-text("New pipeline")',
    );
    if (newPipe) {
      await sleep(700);
      await snap(page, "pipeline_new_dialog");
    }

    // ───────────────────── 18 — Logout ─────────────────────
    log("Logout");
    await page.goto(`${APP}/dashboard`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(400);
    const avatar = await safeClick(
      page,
      'button[aria-label*="ccount"], button[aria-label*="vatar"], button:has-text("YN")',
    );
    if (avatar) {
      await sleep(400);
      await snap(page, "account_menu");
      const out = await safeClick(
        page,
        'li:has-text("Sign Out"), li:has-text("Logout"), [role="menuitem"]:has-text("Sign Out")',
      );
      if (out) {
        await sleep(800);
        await snap(page, "after_logout");
      }
    }

    log("DONE");
  } catch (e) {
    console.error("✗ Tour failed:", e);
    await page.screenshot({ path: path.join(OUT, `_error_${Date.now()}.png`) });
    process.exitCode = 1;
  } finally {
    await ctx.close();
    await browser.close();
  }
})();
