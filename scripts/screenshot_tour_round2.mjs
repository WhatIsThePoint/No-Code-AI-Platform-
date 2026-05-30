/**
 * Demo Day Screenshot Tour — Round 2
 *   - Adds the actions the first pass missed (Companion FAB, demo dataset,
 *     pipeline-new dialog, language toggle effect, high-contrast effect,
 *     2FA setup, admin operations).
 *   - Reuses the already-verified YOussef.nocode account.
 *   - Captures a second pass with admin@nocode-ai.io for the admin views.
 *
 * Run: node scripts/screenshot_tour_round2.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const APP = "http://localhost:5173";
const USER = "YOussef.nocode@ai.com";
const PASS = "YOussef.nocode@ai.com";
const ADMIN = "admin@nocode-ai.io";
const ADMIN_PASS = "Demo1234!";

let counter = 18; // continue numbering after the first pass

const log = (m) => console.log(`▸ ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function snap(page, name, opts = {}) {
  const fp = path.join(OUT, `${String(counter).padStart(2, "0")}_${name}.png`);
  await page.screenshot({ path: fp, fullPage: opts.fullPage ?? false });
  log(`📸 ${fp}`);
  counter += 1;
}

async function safeClick(page, selector, { timeout = 4000 } = {}) {
  try {
    await page.click(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function login(page, email, password) {
  await page.goto(`${APP}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().endsWith("/login"), {
    timeout: 10000,
  });
  await sleep(900);
}

(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      `${process.env.HOME}/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`,
    headless: true,
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  try {
    // ───────────────────── A) YOussef.nocode tour ─────────────────────
    log("Login as YOussef.nocode");
    await login(page, USER, PASS);

    // 18 — Dashboard get-started cards expanded
    await snap(page, "dashboard_get_started", { fullPage: true });

    // 19 — Companion FAB open (gradient bottom-right button)
    log("Open Companion FAB");
    const fabOpened =
      (await safeClick(page, '.MuiFab-root, [class*="MuiFab"]')) ||
      (await safeClick(page, 'button[class*="MuiFab"]'));
    await sleep(900);
    if (fabOpened) {
      await snap(page, "companion_drawer_open");
      // Type a sample question
      const inputBox = await page
        .locator('textarea, input[placeholder*="sk"]')
        .first();
      if (await inputBox.count()) {
        await inputBox.fill("How do I balance my classes?");
        await sleep(400);
        await snap(page, "companion_question_typed");
      }
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(300);
    }

    // 20 — Datasets page → Load Demo Dataset menu
    log("Datasets → Load Demo Dataset");
    await page.goto(`${APP}/data`, { waitUntil: "networkidle" });
    await sleep(800);
    await safeClick(page, 'button:has-text("Load Demo Dataset")');
    await sleep(600);
    await snap(page, "datasets_demo_menu");
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(300);

    // 21 — Datasets page → New Dataset modal
    log("Datasets → New Dataset");
    await safeClick(page, 'button:has-text("New Dataset")');
    await sleep(700);
    await snap(page, "datasets_new_modal");
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(300);

    // 22 — Pipelines → New pipeline dialog (mode picker)
    log("Pipelines → New Pipeline dialog");
    await page.goto(`${APP}/pipelines`, { waitUntil: "networkidle" });
    await sleep(700);
    const newBtnSelectors = [
      'button:has-text("New Pipeline")',
      'button:has-text("New pipeline")',
      'button:has-text("Create Pipeline")',
      'button:has-text("Create pipeline")',
      'button:has-text("New")',
    ];
    for (const sel of newBtnSelectors) {
      if (await safeClick(page, sel, { timeout: 1500 })) break;
    }
    await sleep(800);
    await snap(page, "pipeline_new_dialog");
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(300);

    // 23 — Profile page → Save changes button + 2FA section
    log("Profile page");
    await page.goto(`${APP}/profile`, { waitUntil: "networkidle" });
    await sleep(700);
    await snap(page, "profile_full", { fullPage: true });

    // 24 — Click Enable Two-Factor Authentication
    log("Enable 2FA modal");
    const enabled2FA =
      (await safeClick(page, 'button:has-text("Enable Two-Factor")')) ||
      (await safeClick(page, 'button:has-text("ENABLE TWO-FACTOR")'));
    await sleep(1200);
    if (enabled2FA) {
      await snap(page, "twofa_enable_modal");
    }
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(300);

    // 25 — Billing page (free tier comparison)
    log("Billing — tier comparison");
    await page.goto(`${APP}/billing`, { waitUntil: "networkidle" });
    await sleep(1200);
    await snap(page, "billing_tier_compare", { fullPage: true });

    // 26 — Language toggle → French
    log("Language toggle FR");
    await page.goto(`${APP}/dashboard`, { waitUntil: "networkidle" });
    await sleep(700);
    // Top-right pill labelled EN / FR — click the FR side
    const frToggled =
      (await safeClick(page, 'button:has-text("FR")')) ||
      (await safeClick(page, '[aria-label*="French"]'));
    await sleep(700);
    if (frToggled) {
      await snap(page, "i18n_french_dashboard", { fullPage: true });
    }
    // Switch back to English
    await safeClick(page, 'button:has-text("EN")');
    await sleep(400);

    // 27 — High-contrast theme
    log("High-contrast theme");
    const contrastClicked = await safeClick(
      page,
      'button[aria-label*="ontrast"], button[aria-label*="theme"], button[title*="ontrast"]',
    );
    await sleep(600);
    if (contrastClicked) {
      await snap(page, "high_contrast_dashboard", { fullPage: true });
      await safeClick(
        page,
        'button[aria-label*="ontrast"], button[aria-label*="theme"]',
      );
      await sleep(300);
    }

    // 28 — Notification bell open
    log("Notification bell");
    const bell = await safeClick(
      page,
      'button[aria-label*="otification"], header button:has(svg[data-testid*="Notifications"])',
    );
    if (bell) {
      await sleep(500);
      await snap(page, "notifications_bell_open");
      await page.keyboard.press("Escape").catch(() => {});
    }

    // 29 — Model Registry
    log("Model Registry");
    await page.goto(`${APP}/models`, { waitUntil: "networkidle" });
    await sleep(700);
    await snap(page, "model_registry_empty", { fullPage: true });

    // 30 — Collaborator page (company workspace)
    log("Collaborator page");
    await page.goto(`${APP}/company`, { waitUntil: "networkidle" });
    await sleep(700);
    await snap(page, "collaborator_page", { fullPage: true });

    // 31 — Logout (the top-bar LOGOUT button is direct, no menu needed)
    log("Logout");
    await safeClick(page, 'button:has-text("LOGOUT"), button:has-text("Logout")');
    await sleep(900);
    await snap(page, "after_logout");

    // ───────────────────── B) admin tour ─────────────────────────────
    log("Login as super-admin");
    await login(page, ADMIN, ADMIN_PASS);
    await sleep(600);

    // 32 — Admin landing (Stats & Logs by default)
    await snap(page, "admin_landing", { fullPage: true });

    // 33 — User Management tab
    log("Admin → User Management");
    await safeClick(page, 'button:has-text("User Management"), [role="tab"]:has-text("User")');
    await sleep(900);
    await snap(page, "admin_user_management", { fullPage: true });

    // 34 — Ops Console
    log("Admin → Ops Console");
    await safeClick(page, 'button:has-text("Ops Console"), [role="tab"]:has-text("Ops")');
    await sleep(1200);
    await snap(page, "admin_ops_console", { fullPage: true });

    // 35 — Announcements
    log("Admin → Announcements");
    await safeClick(page, 'button:has-text("Announcements"), [role="tab"]:has-text("Announcements")');
    await sleep(700);
    await snap(page, "admin_announcements", { fullPage: true });

    // 36 — Stats & Logs (audit log)
    log("Admin → Stats & Logs");
    await safeClick(
      page,
      'button:has-text("Stats & Logs"), [role="tab"]:has-text("Stats")',
    );
    await sleep(800);
    await snap(page, "admin_stats_logs", { fullPage: true });

    log("DONE");
  } catch (e) {
    console.error("✗ Round-2 tour failed:", e);
    await page.screenshot({ path: path.join(OUT, `_error_${Date.now()}.png`) });
    process.exitCode = 1;
  } finally {
    await ctx.close();
    await browser.close();
  }
})();
