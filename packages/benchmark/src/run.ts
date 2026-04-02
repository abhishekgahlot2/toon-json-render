/**
 * Benchmark: TOON vs JSON for json-render UI generation
 *
 * Sends the same UI prompts to Claude in two modes:
 * 1. JSON mode (standard json-render output)
 * 2. TOON mode (TOON-encoded json-render output)
 *
 * Measures: output tokens, latency, cost, and decode validity.
 *
 * Usage: pnpm benchmark
 * Requires: ANTHROPIC_API_KEY in .env
 */

import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Load .env from repo root
const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import Anthropic from "@anthropic-ai/sdk";
import { decodeLLMResponse, validateSpec } from "@toon-json-render/core";

const client = new Anthropic();

const SCENARIOS = [
  {
    name: "simple-table",
    prompt: "Create a simple data table with 5 rows showing name, email, and role columns",
  },
  {
    name: "chart-with-data",
    prompt: "Create a bar chart showing monthly revenue data for Jan through Jun",
  },
  {
    name: "contact-form",
    prompt: "Create a contact form with name, email, subject, message fields and a submit button",
  },
  {
    name: "dashboard",
    prompt: "Create a dashboard with 4 stat cards at top, a line chart, and a recent activity table",
  },
  {
    name: "pricing-page",
    prompt: "Create a pricing page with 3 tiers: Free, Pro ($29/mo), Enterprise ($99/mo) with feature lists",
  },
  {
    name: "settings-panel",
    prompt: "Create a settings panel with tabs for Profile, Notifications, Security, each with relevant form fields",
  },
  {
    name: "e-commerce-product",
    prompt: "Create a product page with image gallery, title, price, description, size selector, and add to cart button",
  },
];

const CATALOG = [
  "Stack", "Card", "Button", "Input", "TextArea", "Select", "Table",
  "Tabs", "TabPanel", "Text", "Heading", "Image", "Badge", "Divider",
  "Chart", "BarChart", "LineChart", "PieChart", "Grid", "Container",
  "Form", "FormField", "RadioGroup", "Checkbox", "Switch", "Slider",
  "Avatar", "Icon", "Link", "List", "ListItem",
];

const JSON_SYSTEM_PROMPT = `You are a UI generation assistant. Generate user interfaces using a predefined component catalog.

Available components: ${CATALOG.join(", ")}

Output your response as valid JSON matching the current json-render flat spec:
{
  "root": "main",
  "state": {
    "form": { "name": "", "email": "" }
  },
  "elements": {
    "main": { "type": "Stack", "props": { "spacing": "md" }, "children": ["header", "body"] },
    "header": { "type": "Heading", "props": { "text": "My App" } },
    "body": { "type": "Card", "props": { "title": "Welcome" }, "children": ["nameInput", "submitBtn"] },
    "nameInput": { "type": "Input", "props": { "label": "Name", "value": { "$bindState": "/form/name" } } },
    "submitBtn": { "type": "Button", "props": { "label": "Submit" }, "on": { "press": { "action": "submit" } } }
  }
}

Rules:
1. Only use components from the catalog above.
2. Use a FLAT element map under "elements" — NOT a nested tree. Each key is a unique element ID.
3. Use "type" (not "component") for the component name.
4. Children are arrays of string key references (e.g. ["child1", "child2"]).
5. Include "root" pointing to the top-level element key.
6. Include "state" with relevant initial data for any form inputs.
7. Use { "$bindState": "/path/to/field" } for form input values.
8. Use "on": { "press": { "action": "..." } } for button handlers.
9. Output ONLY valid JSON. No markdown, no explanations.`;

const TOON_SYSTEM_PROMPT = `You are a UI generation assistant. Generate user interfaces using a predefined component catalog.

Available components: ${CATALOG.join(", ")}

IMPORTANT: Output your response in TOON format (Token-Oriented Object Notation), NOT JSON.

TOON is a compact encoding of JSON that uses:
- Indentation (2 spaces) instead of braces for nesting
- Tab-separated values for arrays of objects (table format)
- Minimal quoting (only quote strings with special characters)
- [N] for array lengths, {field1,field2} for object field headers

Output the current json-render flat spec as TOON. The spec uses a FLAT element map (not a nested tree), "type" (not "component"), string key references for children, state, $bindState, optional repeat.statePath, and on.press.

Example TOON:
root: main
state:
  form:
    name:
    email:
elements:
  main:
    type: Stack
    props:
      spacing: md
    children: [2]: header\tbody
  header:
    type: Heading
    props:
      text: My App
  body:
    type: Card
    props:
      title: Welcome
    children: [2]: nameInput\tsubmitBtn
  nameInput:
    type: Input
    props:
      label: Name
      value:
        $bindState: /form/name
  submitBtn:
    type: Button
    props:
      label: Submit
    on:
      press:
        action: submit

Rules:
1. Only use components from the catalog above.
2. Use a FLAT element map under "elements" — NOT a nested tree. Each key is a unique element ID.
3. Use "type" for the component name. Children are string key references.
4. Include "root", "state", and "elements" at the top level.
5. Use $bindState for form input values, on.press for button handlers.
6. Output ONLY valid TOON. No markdown fences, no explanations.`;

interface BenchmarkResult {
  scenario: string;
  format: "json" | "toon";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  outputLength: number;
  valid: boolean;
  error?: string;
}

async function runSingle(
  scenario: { name: string; prompt: string },
  format: "json" | "toon"
): Promise<BenchmarkResult> {
  const systemPrompt = format === "json" ? JSON_SYSTEM_PROMPT : TOON_SYSTEM_PROMPT;
  const start = performance.now();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: scenario.prompt }],
    });

    const latencyMs = Math.round(performance.now() - start);
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let valid = false;
    let error: string | undefined;

    if (format === "json") {
      try {
        const parsed = JSON.parse(text);
        valid = validateSpec(parsed as never).valid;
      } catch (e) {
        error = `JSON parse failed: ${(e as Error).message}`;
      }
    } else {
      try {
        valid = validateSpec(decodeLLMResponse(text)).valid;
      } catch (e) {
        error = `TOON decode failed: ${(e as Error).message}`;
      }
    }

    return {
      scenario: scenario.name,
      format,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      latencyMs,
      outputLength: text.length,
      valid,
      error,
    };
  } catch (e) {
    return {
      scenario: scenario.name,
      format,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      latencyMs: Math.round(performance.now() - start),
      outputLength: 0,
      valid: false,
      error: `API error: ${(e as Error).message}`,
    };
  }
}

function printTable(results: BenchmarkResult[]) {
  const jsonResults = results.filter((r) => r.format === "json");
  const toonResults = results.filter((r) => r.format === "toon");

  console.log("\n" + "=".repeat(110));
  console.log("BENCHMARK RESULTS: TOON vs JSON for json-render");
  console.log("=".repeat(110));

  // Per-scenario comparison
  console.log(
    "\n| Scenario            | JSON Out Tokens | TOON Out Tokens | Savings | JSON Latency | TOON Latency | Speedup | JSON Valid | TOON Valid |"
  );
  console.log(
    "|---------------------|----------------:|----------------:|--------:|-------------:|-------------:|--------:|-----------:|-----------:|"
  );

  let totalJsonOut = 0;
  let totalToonOut = 0;
  let totalJsonLatency = 0;
  let totalToonLatency = 0;

  for (const scenario of SCENARIOS) {
    const json = jsonResults.find((r) => r.scenario === scenario.name);
    const toon = toonResults.find((r) => r.scenario === scenario.name);
    if (!json || !toon) continue;

    const savings = ((1 - toon.outputTokens / json.outputTokens) * 100).toFixed(1);
    const speedup = (json.latencyMs / toon.latencyMs).toFixed(2);

    totalJsonOut += json.outputTokens;
    totalToonOut += toon.outputTokens;
    totalJsonLatency += json.latencyMs;
    totalToonLatency += toon.latencyMs;

    console.log(
      `| ${scenario.name.padEnd(19)} | ${String(json.outputTokens).padStart(15)} | ${String(toon.outputTokens).padStart(15)} | ${(savings + "%").padStart(7)} | ${(json.latencyMs + "ms").padStart(12)} | ${(toon.latencyMs + "ms").padStart(12)} | ${(speedup + "x").padStart(7)} | ${(json.valid ? "YES" : "NO").padStart(10)} | ${(toon.valid ? "YES" : "NO").padStart(10)} |`
    );
  }

  // Totals
  const totalSavings = ((1 - totalToonOut / totalJsonOut) * 100).toFixed(1);
  const totalSpeedup = (totalJsonLatency / totalToonLatency).toFixed(2);

  console.log(
    "|---------------------|----------------:|----------------:|--------:|-------------:|-------------:|--------:|-----------:|-----------:|"
  );
  console.log(
    `| ${"TOTAL".padEnd(19)} | ${String(totalJsonOut).padStart(15)} | ${String(totalToonOut).padStart(15)} | ${(totalSavings + "%").padStart(7)} | ${(totalJsonLatency + "ms").padStart(12)} | ${(totalToonLatency + "ms").padStart(12)} | ${(totalSpeedup + "x").padStart(7)} |            |            |`
  );

  // Cost comparison (Sonnet 4 pricing: $3/MTok input, $15/MTok output)
  const inputPricePerMTok = 3;
  const outputPricePerMTok = 15;

  const jsonInputTokens = jsonResults.reduce((s, r) => s + r.inputTokens, 0);
  const toonInputTokens = toonResults.reduce((s, r) => s + r.inputTokens, 0);

  const jsonCost = (jsonInputTokens / 1_000_000) * inputPricePerMTok + (totalJsonOut / 1_000_000) * outputPricePerMTok;
  const toonCost = (toonInputTokens / 1_000_000) * inputPricePerMTok + (totalToonOut / 1_000_000) * outputPricePerMTok;
  const costSavings = ((1 - toonCost / jsonCost) * 100).toFixed(1);

  console.log("\n--- Cost Estimate (Claude Sonnet 4 pricing) ---");
  console.log(`JSON total cost:  $${jsonCost.toFixed(6)}`);
  console.log(`TOON total cost:  $${toonCost.toFixed(6)}`);
  console.log(`Cost savings:     ${costSavings}%`);

  // OpenUI comparison (from their published benchmarks)
  console.log("\n--- Comparison with OpenUI Lang (published benchmarks) ---");
  console.log(`json-render (JSON):  ${totalJsonOut} output tokens`);
  console.log(`toon-json-render:    ${totalToonOut} output tokens (${totalSavings}% savings)`);
  console.log(`OpenUI Lang:         ~4,800 tokens (published figure for same 7 scenarios)`);
  const vsOpenUi = ((totalToonOut / 4800 - 1) * 100).toFixed(1);
  console.log(`TOON vs OpenUI:      ${Number(vsOpenUi) > 0 ? "+" : ""}${vsOpenUi}% ${Number(vsOpenUi) > 0 ? "(OpenUI uses fewer)" : "(TOON uses fewer)"}`);

  // Errors
  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    console.log("\n--- Errors ---");
    for (const e of errors) {
      console.log(`  ${e.scenario} (${e.format}): ${e.error}`);
    }
  }

  console.log("\n" + "=".repeat(110));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ERROR: ANTHROPIC_API_KEY not set. Create a .env file in the project root.");
    process.exit(1);
  }

  console.log("Starting benchmark: TOON vs JSON for json-render");
  console.log(`Model: claude-sonnet-4-20250514`);
  console.log(`Scenarios: ${SCENARIOS.length}`);
  console.log("");

  const results: BenchmarkResult[] = [];

  for (const scenario of SCENARIOS) {
    process.stdout.write(`  ${scenario.name}... `);

    // Run JSON first, then TOON (sequential to avoid rate limits)
    const jsonResult = await runSingle(scenario, "json");
    const toonResult = await runSingle(scenario, "toon");

    results.push(jsonResult, toonResult);

    const savings = ((1 - toonResult.outputTokens / jsonResult.outputTokens) * 100).toFixed(1);
    console.log(
      `JSON: ${jsonResult.outputTokens} tok / TOON: ${toonResult.outputTokens} tok (${savings}% savings)`
    );
  }

  printTable(results);
}

main().catch(console.error);
