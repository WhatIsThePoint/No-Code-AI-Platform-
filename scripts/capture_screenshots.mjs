#!/usr/bin/env node
// Playwright capture script for the UI screenshots referenced in report.tex
// as \figureplaceholder{...}. Output: docs/figures/<slug>.png
//
// Usage:
//   FRONTEND_URL=http://localhost:5173 API_URL=http://localhost:8000 \
//   DEMO_EMAIL=alice@acme-ml.com DEMO_PASSWORD=Demo1234! \
//   ADMIN_EMAIL=admin@nocode-ai.io ADMIN_PASSWORD=Demo1234! \
//   node scripts/capture_screenshots.mjs [--only=login,dashboard]
//
// Requires: the dev stack running (make up + npm --prefix frontend run dev).
// Probes the API at startup to resolve a real pipeline_id + version_id so
// the canvas / results captures land on a working route rather than a 404.

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
const API_URL = process.env.API_URL ?? "http://localhost:8000";
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "alice@acme-ml.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo1234!";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@nocode-ai.io";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Demo1234!";
const OUT_DIR = resolve(process.cwd(), "docs/figures");

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlyFilter = onlyArg ? new Set(onlyArg.split("=")[1].split(",")) : null;

async function apiLogin(email, password) {
  const r = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`API login ${email} failed: ${r.status}`);
  return (await r.json()).access_token;
}

async function probeTargets(token) {
  const r = await fetch(`${API_URL}/pipelines`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pipelines = (await r.json()).items ?? [];
  const byType = (t) => pipelines.find((p) => p.type === t);
  const withVersion = pipelines.find((p) => p.last_version_id);
  return {
    mlPipelineId: (byType("ml") ?? pipelines[0])?.pipeline_id ?? null,
    dlPipelineId: (byType("dl") ?? pipelines[0])?.pipeline_id ?? null,
    ragPipelineId: (byType("rag") ?? pipelines[0])?.pipeline_id ?? null,
    anyPipelineId: pipelines[0]?.pipeline_id ?? null,
    versionId: withVersion?.last_version_id ?? null,
    versionPipelineId: withVersion?.pipeline_id ?? null,
  };
}

async function uiLogin(page, email, password) {
  await page.context().clearCookies();
  await page.goto(`${FRONTEND_URL}/login`);
  await page.fill("input[type='email'], input[name='email']", email);
  await page.fill("input[type='password']", password);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

function buildSteps(targets) {
  const t = targets;
  return [
    { slug: "login_screen", needsAuth: false, async run(page) {
      await page.goto(`${FRONTEND_URL}/login`);
      await page.waitForLoadState("networkidle");
    }},
    { slug: "dashboard", async run(page) {
      await page.goto(`${FRONTEND_URL}/dashboard`);
      await page.waitForLoadState("networkidle");
    }},
    { slug: "billing_page", async run(page) {
      await page.goto(`${FRONTEND_URL}/billing`);
      await page.waitForLoadState("networkidle");
    }},
    { slug: "connector_wizard", async run(page) {
      await page.goto(`${FRONTEND_URL}/data`);
      await page.waitForLoadState("networkidle");
      const btn = page.getByRole("button", { name: /connect.*database|sql.*connector|add.*source/i }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(800);
      }
    }},
    { slug: "pipeline_editor_ml", async run(page) {
      const id = t.mlPipelineId ?? t.anyPipelineId;
      if (!id) throw new Error("no pipeline_id");
      await page.goto(`${FRONTEND_URL}/pipelines/${id}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1200);
    }},
    { slug: "pipeline_editor_dl", async run(page) {
      const id = t.dlPipelineId ?? t.anyPipelineId;
      if (!id) throw new Error("no pipeline_id");
      await page.goto(`${FRONTEND_URL}/pipelines/${id}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1200);
    }},
    { slug: "node_component_anatomy", async run(page) {
      const id = t.anyPipelineId;
      if (!id) throw new Error("no pipeline_id");
      await page.goto(`${FRONTEND_URL}/pipelines/${id}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    }},
    { slug: "live_training_chart", async run(page) {
      // Best taken mid-training. Stable fallback: open a pipeline with
      // last_version_id set, which exposes the chart on the train node.
      const id = t.versionPipelineId ?? t.anyPipelineId;
      if (!id) throw new Error("no pipeline_id");
      await page.goto(`${FRONTEND_URL}/pipelines/${id}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    }},
    { slug: "shap_chart", async run(page) {
      if (!t.versionId) throw new Error("no model version with results");
      await page.goto(`${FRONTEND_URL}/models/${t.versionId}/results`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    }},
    { slug: "final_results", async run(page) {
      if (!t.versionId) throw new Error("no model version with results");
      await page.goto(`${FRONTEND_URL}/models/${t.versionId}/results`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    }},
    { slug: "model_registry", async run(page) {
      await page.goto(`${FRONTEND_URL}/models`);
      await page.waitForLoadState("networkidle");
    }},
    { slug: "rag_chat", async run(page) {
      const id = t.ragPipelineId ?? t.anyPipelineId;
      if (!id) throw new Error("no pipeline_id");
      await page.goto(`${FRONTEND_URL}/pipelines/${id}`);
      await page.waitForLoadState("networkidle");
      // Try to open the chat drawer if visible.
      const chatBtn = page.getByRole("button", { name: /chat|ask/i }).first();
      if (await chatBtn.isVisible().catch(() => false)) {
        await chatBtn.click();
        await page.waitForTimeout(800);
      }
    }},
    { slug: "manage_access_dialog", async run(page) {
      const id = t.anyPipelineId;
      if (!id) throw new Error("no pipeline_id");
      await page.goto(`${FRONTEND_URL}/pipelines/${id}`);
      await page.waitForLoadState("networkidle");
      const btn = page.getByRole("button", { name: /manage.*access|share|members/i }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(700);
      }
    }},
    { slug: "realtime_presence", async run(page) {
      const id = t.anyPipelineId;
      if (!id) throw new Error("no pipeline_id");
      await page.goto(`${FRONTEND_URL}/pipelines/${id}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    }},
    { slug: "language_toggle", async run(page) {
      await page.goto(`${FRONTEND_URL}/dashboard`);
      await page.waitForLoadState("networkidle");
    }},
    { slug: "image_dataset_node", async run(page) {
      const id = t.dlPipelineId ?? t.anyPipelineId;
      if (!id) throw new Error("no pipeline_id");
      await page.goto(`${FRONTEND_URL}/pipelines/${id}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    }},
    { slug: "dl_predict_panel", async run(page) {
      const id = t.dlPipelineId ?? t.versionPipelineId ?? t.anyPipelineId;
      if (!id) throw new Error("no pipeline_id");
      await page.goto(`${FRONTEND_URL}/pipelines/${id}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    }},
  ];
}

// Super-admin captures (different login required).
const ADMIN_STEPS = [
  { slug: "admin_dashboard", async run(page) {
    await page.goto(`${FRONTEND_URL}/admin`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
  }},
  { slug: "impersonation_banner", async run(page) {
    // Best taken after triggering "View as" on a user — manual follow-up.
    // Stable fallback: capture /admin so the user table is visible.
    await page.goto(`${FRONTEND_URL}/admin`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
  }},
];

async function runSteps(page, steps, results) {
  for (const step of steps) {
    if (onlyFilter && !onlyFilter.has(step.slug)) {
      results.skipped.push(step.slug);
      continue;
    }
    try {
      await step.run(page);
      const out = resolve(OUT_DIR, `${step.slug}.png`);
      await page.screenshot({ path: out, fullPage: true });
      console.log(`OK   ${step.slug}  →  ${out}`);
      results.ok.push(step.slug);
    } catch (err) {
      console.error(`FAIL ${step.slug}: ${err.message}`);
      results.failed.push(step.slug);
    }
  }
}

(async () => {
  await mkdir(OUT_DIR, { recursive: true });

  const userToken = await apiLogin(DEMO_EMAIL, DEMO_PASSWORD);
  const targets = await probeTargets(userToken);
  console.log("probed targets:", targets);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = { ok: [], skipped: [], failed: [] };

  // Pass 1: tenant user
  await uiLogin(page, DEMO_EMAIL, DEMO_PASSWORD);
  await runSteps(page, buildSteps(targets), results);

  // Pass 2: super-admin
  const adminWanted = !onlyFilter || ADMIN_STEPS.some((s) => onlyFilter.has(s.slug));
  if (adminWanted) {
    try {
      await uiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await runSteps(page, ADMIN_STEPS, results);
    } catch (err) {
      console.error(`admin pass skipped: ${err.message}`);
      for (const s of ADMIN_STEPS) results.failed.push(s.slug);
    }
  }

  await browser.close();
  console.log(`\n${results.ok.length} captured, ${results.failed.length} failed, ${results.skipped.length} skipped.`);
  if (results.failed.length) console.log("failed:", results.failed.join(", "));
  process.exit(results.failed.length ? 1 : 0);
})();
