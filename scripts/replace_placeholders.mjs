#!/usr/bin/env node
// Replaces \figureplaceholder{Label}{Description} in report.tex with
// \begin{figure}[h] \centering \includegraphics{...} \caption{Label} \end{figure}
// for any (label → asset path) we can resolve. Unmatched placeholders are
// left untouched so the report still compiles.
//
// Usage:
//   node scripts/replace_placeholders.mjs [--dry-run]
//
// Asset resolution is by exact label match. Edit MAP below to add new
// entries as you produce more diagrams or screenshots.

import { readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const REPORT = resolve(process.cwd(), "report.tex");
const DRY = process.argv.includes("--dry-run");

// (placeholder label in report.tex)  →  (path relative to report.tex)
const MAP = {
  // Screenshots
  "Login screen":                                "docs/figures/login_screen.png",
  "Dashboard screenshot":                         "docs/figures/dashboard.png",
  "Billing page screenshot":                      "docs/figures/billing_page.png",
  "Connector wizard screenshot":                  "docs/figures/connector_wizard.png",
  "Pipeline editor screenshot --- ML mode":       "docs/figures/pipeline_editor_ml.png",
  "Pipeline editor screenshot --- DL mode":       "docs/figures/pipeline_editor_dl.png",
  "Node component anatomy":                       "docs/figures/node_component_anatomy.png",
  "Live training chart screenshot":               "docs/figures/live_training_chart.png",
  "SHAP feature importance chart":                "docs/figures/shap_chart.png",
  "Final results dashboard":                      "docs/figures/final_results.png",
  "RAG chat screenshot":                          "docs/figures/rag_chat.png",
  "Manage Access dialog":                         "docs/figures/manage_access_dialog.png",
  "Real-time presence screenshot":                "docs/figures/realtime_presence.png",
  "Language toggle in action":                    "docs/figures/language_toggle.png",
  "Admin dashboard screenshot":                   "docs/figures/admin_dashboard.png",
  "Impersonation banner":                         "docs/figures/impersonation_banner.png",
  "ImageDatasetNode close-up":                    "docs/figures/image_dataset_node.png",
  "DLPredictPanel screenshot":                    "docs/figures/dl_predict_panel.png",

  // Diagrams
  "Overall system architecture":                  "docs/diagrams/overall_architecture.png",
  "Microservice topology":                        "docs/diagrams/microservice_topology.png",
  "Login + JWT issuance sequence diagram":        "docs/diagrams/login_sequence.png",
  "Class diagram for Sprint 1":                   "docs/diagrams/class_sprint1.png",
  "Asynchronous upload sequence":                 "docs/diagrams/upload_sequence.png",
  "RAG pipeline architecture":                    "docs/diagrams/rag_pipeline.png",
  "DL service architecture":                      "docs/diagrams/dl_service.png",
  "Quantisation $\\to$ VRAM mapping":             "docs/diagrams/quantization_vram.png",
};

async function fileExists(p) {
  try { await access(resolve(p), constants.R_OK); return true; }
  catch { return false; }
}

// Brace-balanced matcher: finds \figureplaceholder{<labelArg>}{<descArg>}
// where descArg may itself contain {…} pairs (e.g. \texttt{...}).
// Returns [start, end, descText] or null if no match starting at `from`.
function findPlaceholder(src, label, from = 0) {
  const cmd = "\\figureplaceholder{" + label + "}{";
  let idx = src.indexOf(cmd, from);
  if (idx < 0) return null;
  let depth = 1;
  let i = idx + cmd.length;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < src.length) { i += 2; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  if (depth !== 0) return null;
  return [idx, i, src.slice(idx + cmd.length, i - 1)];
}

(async () => {
  let src = await readFile(REPORT, "utf8");
  const original = src;
  const matched = [];
  const missing = [];
  const noAsset = [];

  for (const [label, assetPath] of Object.entries(MAP)) {
    const exists = await fileExists(assetPath);
    if (!exists) {
      noAsset.push(`${label}  (missing: ${assetPath})`);
      continue;
    }
    const hit = findPlaceholder(src, label);
    if (!hit) {
      missing.push(label);
      continue;
    }
    const [start, end] = hit;
    const replacement =
      `\\begin{figure}[h]\n` +
      `    \\centering\n` +
      `    \\includegraphics[width=0.85\\linewidth]{${assetPath}}\n` +
      `    \\caption{${label}}\n` +
      `\\end{figure}`;
    src = src.slice(0, start) + replacement + src.slice(end);
    matched.push(label);
  }

  console.log(`Matched + replaced: ${matched.length}`);
  matched.forEach((m) => console.log(`  ✓ ${m}`));
  if (noAsset.length) {
    console.log(`\nAsset file missing (skipped): ${noAsset.length}`);
    noAsset.forEach((m) => console.log(`  · ${m}`));
  }
  if (missing.length) {
    console.log(`\nPlaceholder not found in report.tex: ${missing.length}`);
    missing.forEach((m) => console.log(`  ? ${m}`));
  }

  if (DRY) {
    console.log("\n(dry-run; report.tex not written)");
    return;
  }
  if (src === original) {
    console.log("\nNo changes.");
    return;
  }
  await writeFile(REPORT, src, "utf8");
  console.log("\nreport.tex updated.");
})();
