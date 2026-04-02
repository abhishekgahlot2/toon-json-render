/**
 * Real-world benchmark: tests against the actual json-render example categories
 * from json-render.dev/examples and OpenUI's demo scenarios.
 *
 * These are production-grade UI prompts, not toy examples.
 *
 * Usage: pnpm --filter @toon-json-render/benchmark run bench:real
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

// Real-world scenarios matching json-render.dev examples + OpenUI demos
const SCENARIOS = [
  // ── json-render.dev examples ──
  {
    name: "ai-chat-interface",
    category: "json-render",
    prompt: `Create a full AI chat application interface:
- Sidebar with 5 conversation threads (title, last message preview, timestamp, unread count badge)
- Active conversation header with model selector dropdown (GPT-4, Claude, Gemini), temperature slider
- Message thread with 6 messages alternating user/assistant, including:
  - A plain text response
  - A response with a code block (Python function)
  - A response with a data table (3 cols, 4 rows)
  - A response with a bullet list
  - A user message with an attached image placeholder
  - An assistant message with a "thinking" loading state
- Input bar: textarea, file attach button, model badge, send button, character count
- Typing indicator "Claude is thinking..."`,
  },
  {
    name: "analytics-dashboard-drag",
    category: "json-render",
    prompt: `Create a full analytics dashboard with draggable widget layout:
- Top nav: logo, search bar, notification bell with count badge, user avatar dropdown
- Sidebar: nav items (Overview, Analytics, Customers, Products, Reports, Settings) with icons, active state on Analytics
- Main content area with 6 widgets in a responsive grid:
  1. Revenue card: $45,231.89, +20.1% from last month, sparkline mini chart
  2. Subscriptions card: +2,350, +180.1% from last month
  3. Sales card: +12,234, +19% from last month
  4. Active Now card: +573, +201 since last hour
  5. Line chart: Revenue over 12 months (Jan-Dec) with two series (this year, last year)
  6. Bar chart: Sales by region (North America, Europe, Asia, LatAm) with target vs actual
- Recent transactions table: 8 rows with customer name, email, amount, status badge (success/pending/failed), date
- Pagination: showing 1-8 of 120 results`,
  },
  {
    name: "static-no-ai-forms",
    category: "json-render",
    prompt: `Create a complex form layout with three sections side by side:
Section 1 - User Profile Card:
  - Avatar upload area, full name, email, bio textarea, role dropdown (Admin/Editor/Viewer), save button
Section 2 - Settings Form:
  - Notification toggles (6 switches with labels: Email, Push, SMS, Marketing, Security, Updates)
  - Theme selector (Light/Dark/System radio group)
  - Language dropdown
  - Timezone dropdown
Section 3 - Data Table:
  - Search input, filter dropdowns (Status, Role, Date Range)
  - Table with 10 rows: ID, Name, Email, Role, Status (Active/Inactive/Pending badges), Last Login, Actions (Edit/Delete buttons)
  - Select all checkbox, bulk action dropdown
  - Pagination with page numbers`,
  },
  {
    name: "email-template",
    category: "json-render",
    prompt: `Create a marketing email template layout:
- Header: company logo placeholder, navigation links (Products, Pricing, Blog, Support)
- Hero section: large heading "Introducing our new feature", subheading, CTA button "Get Started"
- Feature grid (2x2): 4 feature cards each with icon placeholder, title, description paragraph
- Testimonial section: quote text, author name, company, avatar
- Pricing comparison: 3 columns (Basic $9/mo, Pro $29/mo, Enterprise $99/mo) with feature checkmarks
- Stats row: 4 metrics (10K+ Users, 99.9% Uptime, 50M+ Requests, 24/7 Support)
- Footer: social icons, address, unsubscribe link, copyright`,
  },
  {
    name: "social-card-og",
    category: "json-render",
    prompt: `Create an OG social card / preview card layout:
- Background gradient
- App icon/logo placeholder (48px)
- Large title "toon-json-render"
- Subtitle "74% fewer LLM tokens for generative UI"
- Stats row: "7/7 Validity", "2.7x Faster", "64% Cheaper"
- Author info: avatar, name, handle
- Bottom bar: GitHub stars count, version number, license badge`,
  },
  {
    name: "3d-scene-config",
    category: "json-render",
    prompt: `Create a 3D scene configuration panel:
- Scene hierarchy tree: 5 objects (Camera, DirectionalLight, AmbientLight, Mesh "Cube", Mesh "Sphere") with expand/collapse and visibility toggles
- Properties panel for selected "Cube":
  - Transform section: Position (X/Y/Z number inputs), Rotation (X/Y/Z sliders), Scale (X/Y/Z)
  - Material section: Color picker, metalness slider (0-1), roughness slider (0-1), opacity slider
  - Geometry section: Width/Height/Depth inputs
- Viewport placeholder (3D canvas area) with toolbar: move/rotate/scale mode buttons, grid toggle, snap toggle
- Bottom timeline: frame counter, play/pause/stop buttons, keyframe markers`,
  },

  // ── OpenUI / Thesys demo scenarios ──
  {
    name: "fintech-copilot",
    category: "openui",
    prompt: `Create a fintech analytics co-pilot dashboard:
- Top bar: "Portfolio Overview" title, date range picker (1D/1W/1M/3M/1Y/All), refresh button
- Portfolio summary cards row: Total Value ($1,247,832.45 +3.2%), Day P&L (+$12,453.20), Total Return (+24.7% all time), Sharpe Ratio (1.82)
- Main chart area: Large area chart showing portfolio value over 6 months with gradient fill, hover tooltip showing date + value
- Holdings table: 8 rows with Ticker, Name, Shares, Avg Cost, Current Price, Market Value, P&L, P&L%, Weight% - sorted by weight
  AAPL/Apple/150/$145.20/$198.50/$29,775/+$7,995/+36.7%/12.3%
  GOOGL/Alphabet/80/$142.00/$175.20/$14,016/+$2,656/+23.4%/8.1%
  MSFT/Microsoft/60/$380.50/$425.10/$25,506/+$2,676/+11.7%/10.5%
  ...5 more rows with realistic data
- Sector allocation pie chart: Technology 42%, Healthcare 18%, Financial 15%, Consumer 12%, Energy 8%, Other 5%
- Recent transactions list: 5 items with date, action (Buy/Sell badge), ticker, shares, price, total`,
  },
  {
    name: "ai-search-results",
    category: "openui",
    prompt: `Create an AI-powered search results page:
- Search bar at top: input with "Best restaurants in Tokyo" query, search button, filters button
- AI Summary card at top: 3-paragraph AI-generated summary with source citations [1][2][3], "Show sources" expandable
- Filter chips row: All, Restaurants, Reviews, Maps, Images
- 6 search result cards, each with:
  - Title link, URL breadcrumb, description paragraph, rating stars (out of 5), review count, price range ($-$$$$)
  - Thumbnail image placeholder
  - Quick facts: cuisine type, location, hours
- "People also ask" section: 4 expandable questions
- Related searches: 6 pill-shaped suggestion buttons
- Pagination: 1 2 3 ... 10 Next`,
  },
  {
    name: "canvas-workspace",
    category: "openui",
    prompt: `Create a canvas-style workspace layout:
- Top toolbar: project name "Q3 Planning", share button, collaborator avatars (3), view mode toggle (Canvas/List/Board)
- Left sidebar: pages list (5 items with icons: Overview, Research, Competitors, Timeline, Budget), add page button
- Main canvas area with 4 positioned cards:
  1. Note card: title "Key Objectives", 5 bullet points of goals, drag handle, resize handle
  2. Image card: placeholder image, caption "Market Analysis Chart", resize handle
  3. Table card: 4x5 comparison matrix (competitors vs features with checkmarks)
  4. Embed card: "Figma Prototype" with embed placeholder, open in new tab link
- Right sidebar: properties panel for selected card (position x/y, size w/h, background color, border toggle, lock toggle)
- Bottom status bar: zoom level slider (25%-400%), minimap, "Last edited 2 minutes ago"`,
  },
  {
    name: "video-editor-timeline",
    category: "json-render",
    prompt: `Create a video editor timeline interface:
- Preview area: video player placeholder (16:9), playback controls (rewind, play/pause, forward, volume slider, fullscreen)
- Current time display: 00:01:23 / 00:05:45, frame rate: 30fps
- Toolbar: cut, split, delete, undo, redo, add text, add transition, add effect
- Timeline area with 4 tracks:
  - Video track: 3 clips (Intro 0-15s, Main 15s-4m, Outro 4m-5:45) with thumbnail previews
  - Audio track: 2 clips (Background Music, Voiceover) with waveform representation
  - Text track: 2 text overlays ("Welcome" at 2s-8s, "Subscribe" at 5m-5:40)
  - Effects track: 1 transition (Fade at 14-16s)
- Track controls: mute/solo/lock buttons per track, track height handle
- Zoom control: timeline zoom slider, fit-to-view button
- Playhead: red vertical line at current position`,
  },
  {
    name: "mobile-app-screens",
    category: "json-render",
    prompt: `Create a mobile app screen layout (phone frame):
- Status bar: time 9:41, signal/wifi/battery icons
- Navigation: back arrow, title "Order Details", share button
- Order header: Order #38291, status badge "Shipped", placed date
- Tracking section: 4 steps vertical stepper (Order Placed ✓, Processing ✓, Shipped ✓ with tracking number, Delivered pending with estimated date)
- Items list: 3 items each with thumbnail, name, variant, qty, price
  - MacBook Pro 14" / Space Black / 1x / $1,999
  - Magic Keyboard / White / 1x / $299
  - USB-C Cable / 2m / 2x / $38
- Order summary: subtotal, shipping, tax, discount (-$50), total ($2,336.00)
- Actions: "Track Package" primary button, "Need Help?" secondary button
- Bottom tab bar: Home, Search, Cart (badge: 2), Orders (active), Profile`,
  },
  {
    name: "terminal-chat",
    category: "json-render",
    prompt: `Create a terminal/CLI-style chat interface:
- Terminal window chrome: 3 dots (red/yellow/green), title "toon-cli v1.0.0"
- Command history showing 4 exchanges:
  1. $ toon generate --prompt "Create a login form" → shows TOON output with syntax highlighting
  2. $ toon decode --input output.toon → shows decoded JSON
  3. $ toon benchmark --scenarios 7 → shows benchmark table (scenario, json tokens, toon tokens, savings %)
  4. $ toon render --preview → shows "Rendering preview on http://localhost:3000"
- Current prompt: blinking cursor after "$ "
- Sidebar: help panel showing available commands (generate, decode, benchmark, render, export)
- Status bar: connected, model: claude-sonnet-4, tokens used: 1,247`,
  },
];

const CATALOG = [
  "Stack","Card","Button","Input","TextArea","Select","Table","Tabs","TabPanel",
  "Text","Heading","Image","Badge","Divider","BarChart","LineChart","PieChart",
  "AreaChart","ScatterChart","Grid","Container","Form","FormField","RadioGroup",
  "Checkbox","Switch","Slider","Avatar","Icon","Link","List","ListItem","Progress",
  "Stepper","StepperStep","Toggle","DatePicker","Dropdown","CodeBlock","Accordion",
  "AccordionItem","Carousel","ImageGallery","Tag","Callout","Separator","Nav",
  "NavItem","Sidebar","Breadcrumb","Tooltip","Calendar","TreeView","TreeItem",
  "Timeline","TimelineItem","Alert","Modal","Drawer","Popover","Skeleton",
];

const JSON_SYS = `You generate UIs as JSON in the current json-render flat spec. Components: ${CATALOG.join(",")}
Format:
{
  "root": "main",
  "state": { "form": { "query": "" } },
  "elements": {
    "main": { "type": "Stack", "props": { "spacing": "md" }, "children": ["heading1", "content"] },
    "heading1": { "type": "Heading", "props": { "text": "App" } },
    "content": { "type": "Card", "props": { "title": "Info" }, "children": ["input1", "btn1"] },
    "input1": { "type": "Input", "props": { "label": "Search", "value": { "$bindState": "/form/query" } } },
    "btn1": { "type": "Button", "props": { "label": "Go" }, "on": { "press": { "action": "search" } } }
  }
}
Flat element map (NOT nested tree). "type" not "component". Children are string key refs. Include state + $bindState for inputs, on.press for buttons.
Omit empty props/children. Use realistic data. Output ONLY valid JSON. No markdown.`;

const TOON_SYS = `You generate UIs in TOON format using the current json-render flat spec. Components: ${CATALOG.join(",")}
TOON: indentation replaces braces, minimal quoting, [N] for array lengths.
Count items before writing [N]. Recount before finishing.
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
    children: [2]: heading1\tcontent
  heading1:
    type: Heading
    props:
      text: App
  content:
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
Flat element map (NOT nested tree). "type" not "component". Children are string key refs. Include state + $bindState for inputs, on.press for buttons.
Use realistic data. Output ONLY valid TOON. No markdown.`;

interface Result {
  scenario: string;
  category: string;
  format: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  valid: boolean;
  error?: string;
}

async function runOne(scenario: typeof SCENARIOS[0], format: "json" | "toon"): Promise<Result> {
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
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("");

    let valid = false, error: string | undefined;
    if (format === "json") {
      try {
        const s = text.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim();
        const p = JSON.parse(s); valid = validateSpec(p as never).valid;
      } catch (e) { error = `Parse: ${(e as Error).message.slice(0, 60)}`; }
    } else {
      try {
        const s = text.replace(/^```toon?\n?/m, "").replace(/\n?```$/m, "").trim();
        valid = validateSpec(decodeLLMResponse(s)).valid;
      } catch {
        error = "Decode: invalid TOON or invalid flat spec";
      }
    }

    return { scenario: scenario.name, category: scenario.category, format, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, latencyMs, valid, error };
  } catch (e) {
    return { scenario: scenario.name, category: scenario.category, format, inputTokens: 0, outputTokens: 0, latencyMs: Math.round(performance.now() - start), valid: false, error: `API: ${(e as Error).message.slice(0, 60)}` };
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY not set."); process.exit(1); }

  console.log(`\nREAL-WORLD BENCHMARK: ${SCENARIOS.length} production UI scenarios`);
  console.log(`Model: ${MODEL}\n`);

  const results: Result[] = [];

  for (const s of SCENARIOS) {
    process.stdout.write(`  [${s.category}] ${s.name}...`);
    const [j, t] = await Promise.all([runOne(s, "json"), runOne(s, "toon")]);
    results.push(j, t);
    const sv = j.outputTokens > 0 ? ((1 - t.outputTokens / j.outputTokens) * 100).toFixed(0) : "?";
    console.log(` json:${j.outputTokens}${j.valid ? "" : "!"} toon:${t.outputTokens}${t.valid ? "" : "!"} (${sv}%)`);
  }

  // Results
  console.log("\n" + "=".repeat(120));
  console.log("| Scenario                   | Category    | JSON Tok | TOON Tok | Savings | JSON OK | TOON OK |");
  console.log("|----------------------------|-------------|--------:|---------:|--------:|--------:|--------:|");

  let tJ = 0, tT = 0, jV = 0, tV = 0;
  for (const s of SCENARIOS) {
    const j = results.find(r => r.scenario === s.name && r.format === "json")!;
    const t = results.find(r => r.scenario === s.name && r.format === "toon")!;
    tJ += j.outputTokens; tT += t.outputTokens;
    if (j.valid) jV++; if (t.valid) tV++;
    const sv = j.outputTokens > 0 ? ((1 - t.outputTokens / j.outputTokens) * 100).toFixed(1) + "%" : "n/a";
    console.log(`| ${s.name.padEnd(26)} | ${s.category.padEnd(11)} | ${String(j.outputTokens).padStart(7)} | ${String(t.outputTokens).padStart(8)} | ${sv.padStart(7)} | ${(j.valid ? "YES" : "NO").padStart(7)} | ${(t.valid ? "YES" : "NO").padStart(7)} |`);
  }

  const totalSv = ((1 - tT / tJ) * 100).toFixed(1);
  console.log("|----------------------------|-------------|--------:|---------:|--------:|--------:|--------:|");
  console.log(`| ${"TOTAL".padEnd(26)} | ${"".padEnd(11)} | ${String(tJ).padStart(7)} | ${String(tT).padStart(8)} | ${(totalSv + "%").padStart(7)} | ${(jV + "/" + SCENARIOS.length).padStart(7)} | ${(tV + "/" + SCENARIOS.length).padStart(7)} |`);

  console.log(`\nOutput cost: JSON $${(tJ / 1e6 * 15).toFixed(4)} vs TOON $${(tT / 1e6 * 15).toFixed(4)} (${((1 - tT / tJ) * 100).toFixed(0)}% savings)`);

  // JSON hit max_tokens count
  const maxed = results.filter(r => r.outputTokens >= 8190);
  if (maxed.length) {
    console.log(`\n${maxed.length} responses hit max_tokens (8192):`);
    maxed.forEach(r => console.log(`  ${r.scenario} (${r.format}): ${r.outputTokens} tokens`));
  }

  const errors = results.filter(r => r.error);
  if (errors.length) {
    console.log("\n--- Errors ---");
    errors.forEach(e => console.log(`  ${e.scenario} (${e.format}): ${e.error}`));
  }

  console.log("\n" + "=".repeat(120));
}

main().catch(console.error);
