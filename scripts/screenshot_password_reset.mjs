/**
 * Password Reset Tour — captures every screen in the forgot/reset round-trip.
 * Restores the original password at the end so the account stays demo-ready.
 *
 * Run: node scripts/screenshot_password_reset.mjs
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import quopri from "quoted-printable";
import utf8 from "utf8";

const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const APP = "http://localhost:5173";
const MH = "http://localhost:8025";
const EMAIL = "YOussef.nocode@ai.com";
const ORIGINAL_PASSWORD = "YOussef.nocode@ai.com";
const TEMP_PASSWORD = "DemoReset1234!";

let counter = 38;
const log = (m) => console.log(`▸ ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function snap(page, name) {
  const fp = path.join(OUT, `${String(counter).padStart(2, "0")}_${name}.png`);
  await page.screenshot({ path: fp });
  log(`📸 ${fp}`);
  counter += 1;
}

function clearMail() {
  try {
    execSync(`curl -sf -X DELETE ${MH}/api/v1/messages`);
  } catch {}
}

function latestResetToken() {
  const out = execSync(`curl -sf ${MH}/api/v2/messages`).toString();
  const j = JSON.parse(out);
  const items = j.items.filter(
    (m) => (m.Content.Headers.Subject[0] || "").toLowerCase().includes("reset"),
  );
  if (!items.length) throw new Error("no reset mail in MailHog");
  const body = utf8.decode(quopri.decode(items[0].Content.Body));
  const m = body.match(/reset-password\?token=([A-Za-z0-9_\-]+)/);
  if (!m) throw new Error("token not found in reset mail");
  return m[1];
}

(async () => {
  clearMail();
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
    // 38 — Sign-in page now shows the "Forgot your password?" link.
    log("Sign In with the new Forgot link");
    await page.goto(`${APP}/login`, { waitUntil: "networkidle" });
    await sleep(500);
    await snap(page, "login_with_forgot_link");

    // 39 — /forgot-password (empty)
    log("Forgot Password form");
    await page.click('button:has-text("Forgot your password?")');
    await page.waitForURL("**/forgot-password");
    await sleep(400);
    await snap(page, "forgot_password_empty");

    // 40 — /forgot-password (filled)
    await page.fill('input[type="email"]', EMAIL);
    await snap(page, "forgot_password_filled");

    // 41 — submit → success card with MailHog hint
    await page.click('button[type="submit"]');
    await page.waitForSelector("text=reset link is now in that inbox", {
      timeout: 6000,
    });
    await sleep(400);
    await snap(page, "forgot_password_success");

    // 42 — MailHog inbox shows the reset mail
    log("MailHog inbox after forgot-password");
    const mh = await ctx.newPage();
    await mh.goto(MH, { waitUntil: "networkidle" });
    await sleep(700);
    await mh.screenshot({
      path: path.join(OUT, `${String(counter).padStart(2, "0")}_mailhog_reset_inbox.png`),
    });
    counter += 1;
    await mh.locator(".messages .row, .row").first().click().catch(() => {});
    await sleep(500);
    await mh.screenshot({
      path: path.join(OUT, `${String(counter).padStart(2, "0")}_mailhog_reset_mail_body.png`),
    });
    counter += 1;
    await mh.close();

    // 43 — Click the reset link
    log("Visit /reset-password with the token");
    const token = latestResetToken();
    await page.goto(`${APP}/reset-password?token=${token}`, {
      waitUntil: "networkidle",
    });
    await sleep(500);
    await snap(page, "reset_password_form_empty");

    // 44 — Filled
    await page.fill('input[type="password"]:first-of-type, input[label="New password"]', TEMP_PASSWORD);
    // Better: fill by label position
    const pwds = page.locator('input[type="password"]');
    await pwds.nth(0).fill(TEMP_PASSWORD);
    await pwds.nth(1).fill(TEMP_PASSWORD);
    await snap(page, "reset_password_form_filled");

    // 45 — Submit → success card
    await page.click('button[type="submit"]');
    await page.waitForSelector("text=Password updated", { timeout: 6000 });
    await sleep(400);
    await snap(page, "reset_password_success");

    // 46 — Login with the new password to prove it works
    log("Sign in with the new password");
    await page.goto(`${APP}/login`, { waitUntil: "networkidle" });
    await sleep(400);
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', TEMP_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.toString().endsWith("/login"), {
      timeout: 8000,
    });
    await sleep(700);
    await snap(page, "dashboard_after_password_reset");

    // ── Restore original password so the demo account remains stable ──
    log("Restore original password via /forgot-password");
    clearMail();
    // Sign out first (so the new login can happen fresh).
    execSync(
      `curl -s -X POST http://localhost:8000/auth/forgot-password -H "Content-Type: application/json" -d '{"email":"${EMAIL.toLowerCase()}"}'`,
    );
    await sleep(800);
    const restoreToken = latestResetToken();
    execSync(
      `curl -s -X POST http://localhost:8000/auth/reset-password -H "Content-Type: application/json" -d '{"token":"${restoreToken}","password":"${ORIGINAL_PASSWORD}"}'`,
    );
    log("Original password restored.");
    clearMail();

    log("DONE");
  } catch (e) {
    console.error("✗ Password-reset tour failed:", e);
    await page.screenshot({ path: path.join(OUT, `_error_${Date.now()}.png`) });
    process.exitCode = 1;
  } finally {
    await ctx.close();
    await browser.close();
  }
})();
