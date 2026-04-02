/**
 * Head-to-head: TOON vs JSON vs OpenUI Lang
 *
 * Sends the same UI prompts to Claude in three output formats
 * and compares output tokens, latency, and validity.
 *
 * Usage: pnpm --filter @toon-json-render/benchmark run bench:openui
 */

import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import Anthropic from "@anthropic-ai/sdk";
import { decodeLLMResponse, validateSpec } from "@toon-json-render/core";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-20250514";

const SCENARIOS = [
  { name: "simple-table", prompt: "Create a simple data table with 5 rows showing name, email, and role columns" },
  { name: "chart-with-data", prompt: "Create a bar chart showing monthly revenue data for Jan through Jun" },
  { name: "contact-form", prompt: "Create a contact form with name, email, subject, message fields and a submit button" },
  { name: "dashboard", prompt: "Create a dashboard with 4 stat cards at top, a line chart, and a recent activity table" },
  { name: "pricing-page", prompt: "Create a pricing page with 3 tiers: Free, Pro ($29/mo), Enterprise ($99/mo) with feature lists" },
  { name: "settings-panel", prompt: "Create a settings panel with tabs for Profile, Notifications, Security, each with relevant form fields" },
  { name: "e-commerce-product", prompt: "Create a product page with image gallery, title, price, description, size selector, and add to cart button" },
];

const CATALOG = [
  "Stack", "Card", "Button", "Input", "TextArea", "Select", "Table",
  "Tabs", "TabPanel", "Text", "Heading", "Image", "Badge", "Divider",
  "Chart", "BarChart", "LineChart", "PieChart", "Grid", "Container",
  "Form", "FormField", "RadioGroup", "Checkbox", "Switch", "Slider",
  "Avatar", "Icon", "Link", "List", "ListItem",
];

const SYSTEM_PROMPTS: Record<string, string> = {
  json: `You are a UI generation assistant. Available components: ${CATALOG.join(", ")}

Output valid JSON in the current json-render flat spec:
{
  "root": "main",
  "state": { "form": { "query": "" } },
  "elements": {
    "main": { "type": "Stack", "props": { "spacing": "md" }, "children": ["heading1", "card1"] },
    "heading1": { "type": "Heading", "props": { "text": "Title" } },
    "card1": { "type": "Card", "props": { "title": "Info" }, "children": ["input1", "btn1"] },
    "input1": { "type": "Input", "props": { "label": "Search", "value": { "$bindState": "/form/query" } } },
    "btn1": { "type": "Button", "props": { "label": "Go" }, "on": { "press": { "action": "search" } } }
  }
}
Key rules: flat element map (not nested tree), "type" not "component", children are string key references, include state + $bindState for inputs, on.press for buttons.
Only use listed components. Output ONLY valid JSON, no markdown.`,

  toon: `You are a UI generation assistant. Available components: ${CATALOG.join(", ")}

Output TOON format (compact JSON encoding) using the current json-render flat spec:
- Indentation instead of braces
- Minimal quoting
- [N] for array lengths
- For arrays of objects, use count-based headers with fields

Example:
root: main
state:
  form:
    query:
elements:
  main:
    type: Stack
    props:
      spacing: md
    children: [2]: heading1\tcard1
  heading1:
    type: Heading
    props:
      text: Title
  card1:
    type: Card
    props:
      title: Info
    children: [2]: input1\tbtn1
  input1:
    type: Input
    props:
      label: Search
      value:
        $bindState: /form/query
  btn1:
    type: Button
    props:
      label: Go
    on:
      press:
        action: search

Array examples:
state:
  revenueData[3]{month,revenue}:
    Jan\t45000
    Feb\t52000
    Mar\t48000
props:
  columns[3]{key,header}:
    name\tName
    email\tEmail
    role\tRole

Counting rules:
- children[2]: heading1\tcard1 means exactly 2 children.
- revenueData[3]{month,revenue}: means exactly 3 rows with 2 fields each.
- Do not use ad hoc '-' list items for object arrays when tabular [N]{...}: form fits.

Key rules: flat element map (not nested tree), "type" not "component", children are string key references, include state + $bindState for inputs, on.press for buttons.
Only use listed components. Output ONLY valid TOON, no markdown.`,

  openui: `You are a UI generation assistant. Available components: ${CATALOG.join(", ")}

Output OpenUI Lang format — a line-oriented assignment syntax:
- Each element: identifier = ComponentName(prop=value, ...)
- Children passed as positional args: parent = Stack([child1, child2])
- Data as arrays: data = [["Jan", 100], ["Feb", 200]]

Example:
root = Stack([card, btn])
card = Card(title="Welcome", subtitle="Hello world")
btn = Button(label="Click me", variant="primary")

Only use listed components. Output ONLY valid OpenUI Lang, no markdown.`,
};

interface Result {
  scenario: string;
  format: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  outputLength: number;
  valid: boolean;
  error?: string;
}

async function runOne(scenario: { name: string; prompt: string }, format: string): Promise<Result> {
  const start = performance.now();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPTS[format],
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
        const stripped = text.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim();
        const p = JSON.parse(stripped);
        valid = validateSpec(p as never).valid;
      } catch (e) { error = `Parse: ${(e as Error).message}`; }
    } else if (format === "toon") {
      try { valid = validateSpec(decodeLLMResponse(text)).valid; } catch (e) { error = `Decode: ${(e as Error).message}`; }
    } else {
      // OpenUI Lang — structural check only; this is weaker than the JSON/TOON validation above.
      valid = text.includes("=") && /\w+\s*=\s*\w+\(/.test(text);
      if (!valid) error = "No valid OpenUI Lang assignments found (structural check only)";
    }

    return {
      scenario: scenario.name,
      format,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
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
      latencyMs: Math.round(performance.now() - start),
      outputLength: 0,
      valid: false,
      error: `API: ${(e as Error).message}`,
    };
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ERROR: ANTHROPIC_API_KEY not set.");
    process.exit(1);
  }

  console.log(`\n3-WAY BENCHMARK: TOON vs JSON vs OpenUI Lang`);
  console.log(`Model: ${MODEL} | Scenarios: ${SCENARIOS.length}\n`);

  const results: Result[] = [];
  const formats = ["json", "toon", "openui"];

  for (const scenario of SCENARIOS) {
    process.stdout.write(`  ${scenario.name}...`);
    for (const format of formats) {
      const r = await runOne(scenario, format);
      results.push(r);
      process.stdout.write(` ${format}:${r.outputTokens}`);
    }
    console.log();
  }

  // Print results
  const pad = (s: string | number, n: number) => String(s).padStart(n);

  console.log("\n" + "=".repeat(120));
  console.log("| Scenario            | JSON Tokens | TOON Tokens | OpenUI Tokens | TOON vs JSON | OpenUI vs JSON | TOON vs OpenUI |");
  console.log("|---------------------|------------:|------------:|--------------:|-------------:|---------------:|---------------:|");

  const totals = { json: 0, toon: 0, openui: 0 };
  const latencies = { json: 0, toon: 0, openui: 0 };

  for (const s of SCENARIOS) {
    const j = results.find((r) => r.scenario === s.name && r.format === "json")!;
    const t = results.find((r) => r.scenario === s.name && r.format === "toon")!;
    const o = results.find((r) => r.scenario === s.name && r.format === "openui")!;

    totals.json += j.outputTokens;
    totals.toon += t.outputTokens;
    totals.openui += o.outputTokens;
    latencies.json += j.latencyMs;
    latencies.toon += t.latencyMs;
    latencies.openui += o.latencyMs;

    const tVsJ = ((1 - t.outputTokens / j.outputTokens) * 100).toFixed(1) + "%";
    const oVsJ = ((1 - o.outputTokens / j.outputTokens) * 100).toFixed(1) + "%";
    const tVsO = t.outputTokens < o.outputTokens
      ? "-" + ((1 - t.outputTokens / o.outputTokens) * 100).toFixed(1) + "%"
      : "+" + ((t.outputTokens / o.outputTokens - 1) * 100).toFixed(1) + "%";

    console.log(
      `| ${s.name.padEnd(19)} | ${pad(j.outputTokens, 11)} | ${pad(t.outputTokens, 11)} | ${pad(o.outputTokens, 13)} | ${pad(tVsJ, 12)} | ${pad(oVsJ, 14)} | ${pad(tVsO, 14)} |`
    );
  }

  const tVsJTotal = ((1 - totals.toon / totals.json) * 100).toFixed(1);
  const oVsJTotal = ((1 - totals.openui / totals.json) * 100).toFixed(1);
  const tVsOTotal = totals.toon < totals.openui
    ? "-" + ((1 - totals.toon / totals.openui) * 100).toFixed(1) + "%"
    : "+" + ((totals.toon / totals.openui - 1) * 100).toFixed(1) + "%";

  console.log("|---------------------|------------:|------------:|--------------:|-------------:|---------------:|---------------:|");
  console.log(
    `| ${"TOTAL".padEnd(19)} | ${pad(totals.json, 11)} | ${pad(totals.toon, 11)} | ${pad(totals.openui, 13)} | ${pad(tVsJTotal + "%", 12)} | ${pad(oVsJTotal + "%", 14)} | ${pad(tVsOTotal, 14)} |`
  );

  console.log("\n--- Latency ---");
  console.log(`JSON:   ${latencies.json}ms total (${Math.round(latencies.json / SCENARIOS.length)}ms avg)`);
  console.log(`TOON:   ${latencies.toon}ms total (${Math.round(latencies.toon / SCENARIOS.length)}ms avg)`);
  console.log(`OpenUI: ${latencies.openui}ms total (${Math.round(latencies.openui / SCENARIOS.length)}ms avg)`);

  console.log("\n--- Validity ---");
  for (const f of formats) {
    const fResults = results.filter((r) => r.format === f);
    const validCount = fResults.filter((r) => r.valid).length;
    console.log(`${f.padEnd(8)}: ${validCount}/${fResults.length} valid`);
  }

  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    console.log("\n--- Errors ---");
    for (const e of errors) {
      console.log(`  ${e.scenario} (${e.format}): ${e.error}`);
    }
  }

  console.log("\n" + "=".repeat(120));
}

main().catch(console.error);
