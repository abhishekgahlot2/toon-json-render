/**
 * Optimized benchmark: tests the library prompt builder vs hand-crafted prompts
 * and compares TOON (optimized) vs JSON vs OpenUI Lang
 *
 * Usage: pnpm --filter @toon-json-render/benchmark run bench:opt
 */

import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import Anthropic from "@anthropic-ai/sdk";
import {
  generateSystemPrompt,
  decodeLLMResponse,
  validateSpec,
  type CatalogConfig,
} from "@toon-json-render/core";

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

const CATALOG: CatalogConfig = {
  components: [
    { name: "Stack", props: { spacing: { type: "string" }, direction: { type: "string" } }, children: true },
    { name: "Card", props: { title: { type: "string" }, value: { type: "string" }, change: { type: "string" } } },
    { name: "Button", props: { label: { type: "string" }, variant: { type: "string", enum: ["primary", "secondary", "ghost"] } } },
    { name: "Input", props: { label: { type: "string" }, placeholder: { type: "string" }, type: { type: "string" } } },
    { name: "TextArea", props: { label: { type: "string" }, placeholder: { type: "string" }, rows: { type: "number" } } },
    { name: "Select", props: { label: { type: "string" }, options: { type: "array" } } },
    { name: "Table", props: { columns: { type: "array" }, rows: { type: "array" } } },
    { name: "Tabs", children: true },
    { name: "TabPanel", props: { label: { type: "string" } }, children: true },
    { name: "Text", props: { content: { type: "string" }, size: { type: "string" } } },
    { name: "Heading", props: { text: { type: "string" }, level: { type: "number" } } },
    { name: "Image", props: { src: { type: "string" }, alt: { type: "string" } } },
    { name: "Badge", props: { text: { type: "string" }, color: { type: "string" } } },
    { name: "Divider" },
    { name: "BarChart", props: { data: { type: "array" }, xKey: { type: "string" }, yKey: { type: "string" } } },
    { name: "LineChart", props: { data: { type: "array" }, xKey: { type: "string" }, yKey: { type: "string" } } },
    { name: "PieChart", props: { data: { type: "array" } } },
    { name: "Grid", props: { cols: { type: "number" } }, children: true },
    { name: "Container", props: { maxWidth: { type: "string" } }, children: true },
    { name: "Form", children: true },
    { name: "FormField", props: { label: { type: "string" } }, children: true },
    { name: "RadioGroup", props: { label: { type: "string" }, options: { type: "array" } } },
    { name: "Checkbox", props: { label: { type: "string" } } },
    { name: "Switch", props: { label: { type: "string" } } },
    { name: "List", children: true },
    { name: "ListItem", props: { text: { type: "string" } } },
    { name: "Icon", props: { name: { type: "string" } } },
    { name: "Link", props: { href: { type: "string" }, text: { type: "string" } } },
  ],
};

const CATALOG_NAMES = CATALOG.components.map((c) => c.name);

// Generate prompts using the library (not hand-written)
const TOON_PROMPT_FULL = generateSystemPrompt(CATALOG, { compact: false, includeExample: true });
const TOON_PROMPT_COMPACT = generateSystemPrompt(CATALOG, { compact: true, includeExample: true });

const JSON_PROMPT = `You generate UIs as JSON in the current json-render flat spec. Available components: ${CATALOG_NAMES.join(", ")}

Format:
{
  "root": "main",
  "state": { "form": { "name": "" } },
  "elements": {
    "main": { "type": "Stack", "props": { "spacing": "md" }, "children": ["child1"] },
    "child1": { "type": "Input", "props": { "label": "Name", "value": { "$bindState": "/form/name" } } }
  }
}
Key rules: flat element map (not nested tree), "type" not "component", children are string key references, include state + $bindState for inputs, on.press for buttons.
Omit props and children when empty. Output ONLY valid JSON, no markdown.`;

const OPENUI_PROMPT = `You generate UIs in OpenUI Lang. Available components: ${CATALOG_NAMES.join(", ")}

Format: identifier = Component(prop=value)
Children: parent = Stack([child1, child2])
Example:
root = Stack([card, btn])
card = Card(title="Hello")
btn = Button(label="Go", variant="primary")

Output ONLY valid OpenUI Lang, no markdown.`;
// NOTE: TOON prompts are generated by generateSystemPrompt() from core library

type Format = "json" | "toon-full" | "toon-compact" | "openui";

const PROMPTS: Record<Format, string> = {
  json: JSON_PROMPT,
  "toon-full": TOON_PROMPT_FULL,
  "toon-compact": TOON_PROMPT_COMPACT,
  openui: OPENUI_PROMPT,
};

interface Result {
  scenario: string;
  format: Format;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  valid: boolean;
  error?: string;
}

async function runOne(scenario: { name: string; prompt: string }, format: Format): Promise<Result> {
  const start = performance.now();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: PROMPTS[format],
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
        const p = JSON.parse(stripped); valid = validateSpec(p as never).valid;
      } catch (e) { error = `Parse: ${(e as Error).message}`; }
    } else if (format.startsWith("toon")) {
      try {
        valid = validateSpec(decodeLLMResponse(text)).valid;
      } catch (e) {
        error = `Decode: ${(e as Error).message}`;
      }
    } else {
      // OpenUI Lang — structural check only; weaker than JSON/TOON validation.
      valid = /\w+\s*=\s*\w+\(/.test(text);
      if (!valid) error = "No valid OpenUI Lang assignments";
    }

    return { scenario: scenario.name, format, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, latencyMs, valid, error };
  } catch (e) {
    return { scenario: scenario.name, format, inputTokens: 0, outputTokens: 0, latencyMs: Math.round(performance.now() - start), valid: false, error: `API: ${(e as Error).message}` };
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ERROR: ANTHROPIC_API_KEY not set.");
    process.exit(1);
  }

  const formats: Format[] = ["json", "toon-full", "toon-compact", "openui"];

  // Show prompt token overhead
  console.log(`\n=== OPTIMIZED 4-WAY BENCHMARK ===`);
  console.log(`Model: ${MODEL} | Scenarios: ${SCENARIOS.length}\n`);
  console.log("Prompt sizes (chars):");
  for (const f of formats) {
    console.log(`  ${f.padEnd(14)}: ${PROMPTS[f].length} chars`);
  }
  console.log();

  const results: Result[] = [];

  for (const scenario of SCENARIOS) {
    process.stdout.write(`  ${scenario.name}...`);
    for (const format of formats) {
      const r = await runOne(scenario, format);
      results.push(r);
      process.stdout.write(` ${format}:${r.outputTokens}`);
    }
    console.log();
  }

  // Results table
  const pad = (s: string | number, n: number) => String(s).padStart(n);
  console.log("\n" + "=".repeat(140));
  console.log("| Scenario            | JSON Out | TOON Full | TOON Compact | OpenUI | TF vs JSON | TC vs JSON | TC vs OpenUI |");
  console.log("|---------------------|--------:|---------:|------------:|-------:|-----------:|-----------:|-------------:|");

  const totals: Record<Format, { out: number; inp: number; lat: number }> = {
    json: { out: 0, inp: 0, lat: 0 },
    "toon-full": { out: 0, inp: 0, lat: 0 },
    "toon-compact": { out: 0, inp: 0, lat: 0 },
    openui: { out: 0, inp: 0, lat: 0 },
  };

  for (const s of SCENARIOS) {
    const get = (f: Format) => results.find((r) => r.scenario === s.name && r.format === f)!;
    const j = get("json"), tf = get("toon-full"), tc = get("toon-compact"), o = get("openui");

    for (const [f, r] of [["json", j], ["toon-full", tf], ["toon-compact", tc], ["openui", o]] as const) {
      totals[f].out += r.outputTokens;
      totals[f].inp += r.inputTokens;
      totals[f].lat += r.latencyMs;
    }

    const tfVsJ = ((1 - tf.outputTokens / j.outputTokens) * 100).toFixed(1) + "%";
    const tcVsJ = ((1 - tc.outputTokens / j.outputTokens) * 100).toFixed(1) + "%";
    const tcVsO = tc.outputTokens <= o.outputTokens
      ? "-" + ((1 - tc.outputTokens / o.outputTokens) * 100).toFixed(1) + "%"
      : "+" + ((tc.outputTokens / o.outputTokens - 1) * 100).toFixed(1) + "%";

    console.log(
      `| ${s.name.padEnd(19)} | ${pad(j.outputTokens, 7)} | ${pad(tf.outputTokens, 8)} | ${pad(tc.outputTokens, 11)} | ${pad(o.outputTokens, 6)} | ${pad(tfVsJ, 10)} | ${pad(tcVsJ, 10)} | ${pad(tcVsO, 12)} |`
    );
  }

  // Totals
  const tfVsJ = ((1 - totals["toon-full"].out / totals.json.out) * 100).toFixed(1);
  const tcVsJ = ((1 - totals["toon-compact"].out / totals.json.out) * 100).toFixed(1);
  const tcVsO = totals["toon-compact"].out <= totals.openui.out
    ? "-" + ((1 - totals["toon-compact"].out / totals.openui.out) * 100).toFixed(1) + "%"
    : "+" + ((totals["toon-compact"].out / totals.openui.out - 1) * 100).toFixed(1) + "%";

  console.log("|---------------------|--------:|---------:|------------:|-------:|-----------:|-----------:|-------------:|");
  console.log(
    `| ${"TOTAL".padEnd(19)} | ${pad(totals.json.out, 7)} | ${pad(totals["toon-full"].out, 8)} | ${pad(totals["toon-compact"].out, 11)} | ${pad(totals.openui.out, 6)} | ${pad(tfVsJ + "%", 10)} | ${pad(tcVsJ + "%", 10)} | ${pad(tcVsO, 12)} |`
  );

  // Input tokens + total cost
  console.log("\n--- Input Token Overhead ---");
  for (const f of formats) {
    console.log(`  ${f.padEnd(14)}: ${totals[f].inp} input tokens total (${Math.round(totals[f].inp / SCENARIOS.length)} avg)`);
  }

  console.log("\n--- Latency ---");
  for (const f of formats) {
    console.log(`  ${f.padEnd(14)}: ${totals[f].lat}ms total (${Math.round(totals[f].lat / SCENARIOS.length)}ms avg)`);
  }

  // Cost (Sonnet 4: $3/M input, $15/M output)
  console.log("\n--- Total Cost (Sonnet 4: $3/M in, $15/M out) ---");
  for (const f of formats) {
    const cost = (totals[f].inp / 1e6) * 3 + (totals[f].out / 1e6) * 15;
    console.log(`  ${f.padEnd(14)}: $${cost.toFixed(6)}`);
  }

  // Validity
  console.log("\n--- Validity ---");
  for (const f of formats) {
    const fResults = results.filter((r) => r.format === f);
    const validCount = fResults.filter((r) => r.valid).length;
    console.log(`  ${f.padEnd(14)}: ${validCount}/${fResults.length}`);
  }

  const errors = results.filter((r) => r.error);
  if (errors.length) {
    console.log("\n--- Errors ---");
    for (const e of errors) console.log(`  ${e.scenario} (${e.format}): ${e.error}`);
  }

  console.log("\n" + "=".repeat(140));
}

main().catch(console.error);
