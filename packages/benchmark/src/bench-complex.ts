/**
 * Complex UI benchmark: stress-tests TOON on real-world UIs
 * that push the limits - deeply nested, data-heavy, mixed layouts.
 *
 * Usage: pnpm --filter @toon-json-render/benchmark run bench:complex
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

const COMPLEX_SCENARIOS = [
  {
    name: "stock-ticker",
    prompt: `Create a stock ticker dashboard showing:
- A header with market status (open/closed) and current time
- 5 stock cards in a grid, each showing: symbol, company name, current price, change amount, change percentage, a mini sparkline indicator (up/down)
- Stocks: AAPL ($198.50, +2.30, +1.17%), GOOGL ($175.20, -0.80, -0.45%), MSFT ($425.10, +5.60, +1.33%), AMZN ($188.90, +1.20, +0.64%), TSLA ($245.30, -8.40, -3.31%)
- A table below showing top gainers and losers with 8 rows`,
  },
  {
    name: "analytics-dashboard",
    prompt: `Create a full analytics dashboard with:
- Top row: 6 stat cards showing Total Users (2.4M), Revenue ($1.2M), Conversion Rate (3.2%), Bounce Rate (42%), Avg Session (4m 23s), Pages/Session (5.7)
- Second row: A line chart showing monthly revenue for the last 12 months with data points
- Third row: Two side-by-side charts - a pie chart showing traffic sources (Direct 35%, Organic 28%, Social 20%, Referral 12%, Email 5%) and a bar chart showing top 5 pages by views
- Bottom: A data table with 10 rows showing recent user activity (timestamp, user, action, page, duration)`,
  },
  {
    name: "pricing-complex",
    prompt: `Create a complex pricing page with:
- 4 tiers: Hobby (Free), Starter ($19/mo), Pro ($49/mo), Enterprise (custom)
- Each tier has: name, price, description, a list of 8-10 features with checkmarks/x marks showing availability
- Features: API Access, Custom Domain, Team Members (1/5/unlimited/unlimited), Storage (1GB/10GB/100GB/unlimited), Analytics, Priority Support, SSO, Custom Integrations, SLA, Dedicated Account Manager
- A comparison table below showing all features across all tiers
- FAQ section with 5 collapsible questions about billing, refunds, upgrades, enterprise features, and data export`,
  },
  {
    name: "kanban-board",
    prompt: `Create a project management kanban board with:
- 4 columns: Backlog (5 cards), In Progress (3 cards), Review (2 cards), Done (4 cards)
- Each card shows: title, description (1-2 lines), priority badge (low/medium/high/critical), assignee avatar with name, due date, tag badges (bug/feature/improvement)
- Column headers show count and have an add button
- Use realistic task names like "Fix authentication timeout", "Redesign user profile page", "Add export to CSV", etc.`,
  },
  {
    name: "data-table-complex",
    prompt: `Create a complex data table showing employee records:
- Filters bar at top: department dropdown, status dropdown, search input, date range picker
- Table with 12 rows and 8 columns: ID, Full Name, Email, Department, Role, Salary, Start Date, Status (Active/On Leave/Terminated)
- Use realistic employee data with varied departments (Engineering, Design, Marketing, Sales, HR)
- Pagination bar at bottom showing page 1 of 5, with page size selector
- Sort indicators on column headers
- Summary row at bottom showing total headcount and average salary`,
  },
  {
    name: "multi-step-form",
    prompt: `Create a multi-step form wizard for user onboarding:
- Step indicator showing 4 steps: Personal Info, Company Details, Preferences, Review
- Currently on step 2 (Company Details)
- Step 1 fields (completed): First Name, Last Name, Email, Phone, Profile Photo upload
- Step 2 fields (active): Company Name, Industry dropdown (10 options), Company Size radio group (1-10/11-50/51-200/201-1000/1000+), Website URL, Company Description textarea, Address fields (Street, City, State, Zip, Country)
- Navigation: Back and Continue buttons
- Progress bar showing 50% complete`,
  },
  {
    name: "chat-interface",
    prompt: `Create a chat/messaging interface with:
- Sidebar showing 6 conversations with avatar, name, last message preview, timestamp, unread badge
- Main chat area with 8 messages alternating between two users
- Messages include: plain text, a code block, an image placeholder, a link preview card
- Message metadata: timestamp, read receipts (single check, double check, blue double check)
- Input bar at bottom with: text input, emoji picker button, file attach button, send button
- Typing indicator showing "Alex is typing..."`,
  },
  {
    name: "charts-mixed",
    prompt: `Create a charts dashboard with 6 different chart types in a 3x2 grid:
1. Line chart: Monthly revenue trend for 2024-2025 (24 data points)
2. Bar chart: Sales by region (North America, Europe, Asia, Latin America, Africa) with actual vs target
3. Pie chart: Budget allocation (R&D 30%, Marketing 25%, Operations 20%, Sales 15%, Admin 10%)
4. Area chart: Website traffic over 30 days with 3 series (Desktop, Mobile, Tablet)
5. Scatter plot: Price vs Rating for 15 products
6. Horizontal bar chart: Top 10 features by user requests with vote counts`,
  },
  {
    name: "ecommerce-checkout",
    prompt: `Create a full e-commerce checkout page:
- Order summary sidebar: 4 items with thumbnail, name, variant, quantity, price. Subtotal, shipping, tax, discount code input, total
- Items: MacBook Pro 14" ($1,999), AirPods Pro ($249), Magic Keyboard ($299), AppleCare+ ($199)
- Main form: Shipping address (all fields), shipping method radio group (Standard Free 5-7 days, Express $12.99 2-3 days, Overnight $24.99), payment section (card number, expiry, CVC, name on card)
- Trust badges and secure checkout indicator`,
  },
  {
    name: "settings-complex",
    prompt: `Create a comprehensive settings page with a sidebar and 6 tabs:
- Sidebar: Profile, Account, Notifications, Appearance, Privacy, Billing
- Currently showing Notifications tab with sections:
  - Email notifications: 8 toggle switches for different email types (Marketing, Product Updates, Security Alerts, Weekly Digest, Comment Replies, Mentions, Team Invites, Billing)
  - Push notifications: 5 toggle switches
  - Notification schedule: quiet hours start/end time pickers, timezone dropdown
  - Channel preferences: table with 4 notification types x 3 channels (Email, Push, SMS) with checkboxes`,
  },
];

const CATALOG = [
  "Stack", "Card", "Button", "Input", "TextArea", "Select", "Table",
  "Tabs", "TabPanel", "Text", "Heading", "Image", "Badge", "Divider",
  "BarChart", "LineChart", "PieChart", "AreaChart", "ScatterChart",
  "Grid", "Container", "Form", "FormField", "RadioGroup", "Checkbox",
  "Switch", "Slider", "Avatar", "Icon", "Link", "List", "ListItem",
  "Progress", "Stepper", "StepperStep", "Toggle", "DatePicker",
  "Dropdown", "Modal", "Tooltip", "Alert", "Sidebar", "Nav", "NavItem",
];

const JSON_SYS = `You generate UIs as JSON in the current json-render flat spec. Components: ${CATALOG.join(", ")}
Format:
{
  "root": "main",
  "state": { "form": { "search": "" } },
  "elements": {
    "main": { "type": "Stack", "props": { "spacing": "md" }, "children": ["header", "body"] },
    "header": { "type": "Heading", "props": { "text": "Dashboard" } },
    "body": { "type": "Card", "props": { "title": "Info" }, "children": ["input1", "btn1"] },
    "input1": { "type": "Input", "props": { "label": "Search", "value": { "$bindState": "/form/search" } } },
    "btn1": { "type": "Button", "props": { "label": "Go" }, "on": { "press": { "action": "search" } } }
  }
}
Flat element map (NOT nested tree). "type" not "component". Children are string key refs. Include state + $bindState for inputs, on.press for buttons.
Omit empty props/children. Output ONLY valid JSON. No markdown fences.`;

const TOON_SYS = `You generate UIs in TOON format using the current json-render flat spec. Components: ${CATALOG.join(", ")}
TOON rules: indentation replaces braces, minimal quoting, [N] for array lengths.
Count items carefully before writing [N]. Recount before finishing.
Example:
root: main
state:
  form:
    search:
elements:
  main:
    type: Stack
    props:
      spacing: md
    children: [2]: header\tbody
  header:
    type: Heading
    props:
      text: Dashboard
  body:
    type: Card
    props:
      title: Info
    children: [2]: input1\tbtn1
  input1:
    type: Input
    props:
      label: Search
      value:
        $bindState: /form/search
  btn1:
    type: Button
    props:
      label: Go
    on:
      press:
        action: search
Flat element map (NOT nested tree). "type" not "component". Children are string key refs. Include state + $bindState for inputs, on.press for buttons.
Omit empty props/children. Output ONLY valid TOON. No markdown.`;

interface Result {
  scenario: string;
  format: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  valid: boolean;
  error?: string;
}

async function runOne(
  scenario: { name: string; prompt: string },
  format: "json" | "toon"
): Promise<Result> {
  const sys = format === "json" ? JSON_SYS : TOON_SYS;
  const start = performance.now();
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: sys,
      messages: [{ role: "user", content: scenario.prompt }],
    });
    const latencyMs = Math.round(performance.now() - start);
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let valid = false;
    let error: string | undefined;

    if (format === "json") {
      try {
        const stripped = text.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim();
        const parsed = JSON.parse(stripped);
        valid = validateSpec(parsed as never).valid;
      } catch (e) {
        error = `Parse: ${(e as Error).message.slice(0, 80)}`;
      }
    } else {
      try {
        valid = validateSpec(decodeLLMResponse(text)).valid;
      } catch {
        error = `Decode: invalid TOON or invalid flat spec`;
      }
    }

    return {
      scenario: scenario.name, format,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      latencyMs, valid, error,
    };
  } catch (e) {
    return {
      scenario: scenario.name, format,
      inputTokens: 0, outputTokens: 0,
      latencyMs: Math.round(performance.now() - start),
      valid: false, error: `API: ${(e as Error).message.slice(0, 80)}`,
    };
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set.");
    process.exit(1);
  }

  console.log(`\nCOMPLEX UI BENCHMARK: TOON vs JSON`);
  console.log(`Model: ${MODEL} | Scenarios: ${COMPLEX_SCENARIOS.length}\n`);

  const results: Result[] = [];

  for (const scenario of COMPLEX_SCENARIOS) {
    process.stdout.write(`  ${scenario.name}...`);
    const [j, t] = await Promise.all([
      runOne(scenario, "json"),
      runOne(scenario, "toon"),
    ]);
    results.push(j, t);
    const sv = j.outputTokens > 0 ? ((1 - t.outputTokens / j.outputTokens) * 100).toFixed(0) : "?";
    console.log(` json:${j.outputTokens}${j.valid ? "" : "!"} toon:${t.outputTokens}${t.valid ? "" : "!"} (${sv}%)`);
  }

  // Print results
  console.log("\n" + "=".repeat(110));
  console.log("| Scenario              | JSON Tokens | TOON Tokens | Savings | JSON Valid | TOON Valid |");
  console.log("|-----------------------|------------:|------------:|--------:|-----------:|-----------:|");

  let totalJ = 0, totalT = 0, jValid = 0, tValid = 0;

  for (const s of COMPLEX_SCENARIOS) {
    const j = results.find(r => r.scenario === s.name && r.format === "json")!;
    const t = results.find(r => r.scenario === s.name && r.format === "toon")!;
    totalJ += j.outputTokens;
    totalT += t.outputTokens;
    if (j.valid) jValid++;
    if (t.valid) tValid++;
    const sv = j.outputTokens > 0 ? ((1 - t.outputTokens / j.outputTokens) * 100).toFixed(1) + "%" : "n/a";
    console.log(
      `| ${s.name.padEnd(21)} | ${String(j.outputTokens).padStart(11)} | ${String(t.outputTokens).padStart(11)} | ${sv.padStart(7)} | ${(j.valid ? "YES" : "NO").padStart(10)} | ${(t.valid ? "YES" : "NO").padStart(10)} |`
    );
  }

  const totalSv = ((1 - totalT / totalJ) * 100).toFixed(1);
  console.log("|-----------------------|------------:|------------:|--------:|-----------:|-----------:|");
  console.log(
    `| ${"TOTAL".padEnd(21)} | ${String(totalJ).padStart(11)} | ${String(totalT).padStart(11)} | ${(totalSv + "%").padStart(7)} | ${(jValid + "/" + COMPLEX_SCENARIOS.length).padStart(10)} | ${(tValid + "/" + COMPLEX_SCENARIOS.length).padStart(10)} |`
  );

  // Cost
  const jCost = (totalJ / 1e6) * 15;
  const tCost = (totalT / 1e6) * 15;
  console.log(`\nOutput cost: JSON $${jCost.toFixed(4)} vs TOON $${tCost.toFixed(4)} (${((1 - tCost / jCost) * 100).toFixed(0)}% savings)`);

  const errors = results.filter(r => r.error);
  if (errors.length) {
    console.log("\n--- Errors ---");
    errors.forEach(e => console.log(`  ${e.scenario} (${e.format}): ${e.error}`));
  }

  console.log("\n" + "=".repeat(110));
}

main().catch(console.error);
