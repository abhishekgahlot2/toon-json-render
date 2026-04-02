/**
 * Generate static demo data for the landing page.
 * Uses the local Anthropic API key to produce JSON and TOON outputs
 * for each demo scenario, then writes them as a JS file for the site.
 *
 * Usage: pnpm --filter @toon-json-render/benchmark run gen:demos
 */

import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { writeFileSync } from "fs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-20250514";

const CATALOG = [
  "Stack", "Card", "Button", "Input", "TextArea", "Select", "Table",
  "Tabs", "TabPanel", "Text", "Heading", "Image", "Badge", "Divider",
  "BarChart", "LineChart", "PieChart", "AreaChart",
  "Grid", "Container", "Form", "FormField", "RadioGroup", "Checkbox",
  "Switch", "Slider", "Avatar", "Icon", "Link", "List", "ListItem",
  "Progress", "Stepper", "Toggle", "DatePicker", "Dropdown",
];

const JSON_SYS = `You generate UIs as json-render v2 JSON. Available components: ${CATALOG.join(", ")}

The top-level structure is:
{
  "root": "<key>",
  "state": { ... },
  "elements": { "<key>": { ... }, ... }
}

Rules:
- "root" is the string key of the root element in the elements map.
- "state" holds all reactive data as a nested object (form values, lists, toggles, counters, etc.). Populate it with realistic sample data that matches the UI.
- "elements" is a FLAT map of string keys to element definitions. NEVER nest element objects inside each other.
- Each element has: "type" (component name), "props" (object), and optionally "children" (array of string keys referencing other elements).
- "children" values are string keys, NOT inline element objects.
- Use "$bindState" in a prop value to two-way bind to a state path: { "$bindState": "/form/email" }
- Use "$state" to read a state value: { "$state": "/user/name" }
- Use "on" for event handlers: "on": { "press": { "action": "setState", "path": "/counter", "value": { "$state": "/counter" } } }
- Use "repeat" to loop over a state array: "repeat": { "source": { "$state": "/items" }, "as": "$item", "indexAs": "$index" }
  Inside a repeated element, use { "$item": "/name" } or { "$index": true } in props.
- Use "visible" with a $state reference to conditionally show elements.
- Omit empty props, empty children arrays, and unused fields.
- Choose descriptive element keys like "headerCard", "nameInput", "submitBtn", "row0", etc.

Example:
{
  "root": "main",
  "state": {
    "form": { "name": "", "email": "" },
    "submitted": false
  },
  "elements": {
    "main": { "type": "Card", "props": { "title": "Contact" }, "children": ["nameInput", "emailInput", "submitBtn"] },
    "nameInput": { "type": "Input", "props": { "label": "Name", "placeholder": "Your name", "value": { "$bindState": "/form/name" } } },
    "emailInput": { "type": "Input", "props": { "label": "Email", "placeholder": "you@example.com", "value": { "$bindState": "/form/email" } } },
    "submitBtn": { "type": "Button", "props": { "label": "Send" }, "on": { "press": { "action": "setState", "path": "/submitted", "value": true } } }
  }
}

Output ONLY valid JSON. No markdown fences, no explanations.`;

const TOON_SYS = `You generate UIs in TOON encoding of json-render v2. Available components: ${CATALOG.join(", ")}

TOON is a whitespace-delimited encoding of the json-render v2 format (root, state, elements as a flat map).

TOON rules:
- Indentation replaces braces/brackets. Each indent level is 2 spaces.
- Minimal quoting: only quote strings that contain colons, leading/trailing spaces, or are empty.
- [N] before a block denotes an array or map with N entries. Count items carefully before writing [N].
- Element keys in the elements map are written as the key followed by a colon, then the element fields indented below.
- "children" is an array of string key references (NOT nested element objects).
- Use $bindState: /path for two-way form binding.
- Use $state: /path to read state values.
- Use on.press with action/path/value for event handlers.
- Use repeat with source/as/indexAs for list iteration. Inside repeated elements, use $item: /field.
- Use visible with a $state reference for conditional rendering.

Example:
root: main
state:
  form:
    name:
    email:
  submitted: false
elements: [3]
  main:
    type: Card
    props:
      title: Contact
    children: [2]: nameInput\temailInput
  nameInput:
    type: Input
    props:
      label: Name
      placeholder: Your name
      value:
        $bindState: /form/name
  emailInput:
    type: Input
    props:
      label: Email
      placeholder: "you@example.com"
      value:
        $bindState: /form/email
  submitBtn:
    type: Button
    props:
      label: Send
    on:
      press:
        action: setState
        path: /submitted
        value: true

Omit empty props, empty children, and unused fields. Output ONLY valid TOON. No markdown fences, no explanations.`;

const DEMOS = [
  { id: "contact-form", label: "Contact form", prompt: "Create a contact form with name, email, subject, and message fields with a send button" },
  { id: "login", label: "Login form", prompt: "Create a login form with email, password, remember me checkbox, forgot password link, sign in button, and a Google sign-in button" },
  { id: "pricing", label: "Pricing page", prompt: "Create a pricing page with 3 tiers: Free ($0), Pro ($29/mo with Popular badge), Enterprise (Custom). Each has 4-5 features and a CTA button." },
  { id: "dashboard", label: "Dashboard", prompt: "Create a dashboard with 4 stat cards (Revenue $45,231 +20%, Users 2,350 +12%, Orders 1,247 +8%, Conversion 3.2% -0.4%), a line chart with 6 months of revenue data, and an orders table with 5 rows" },
  { id: "stock-ticker", label: "Stock ticker", prompt: "Create a stock ticker with 5 cards in a grid: AAPL $198.50 +1.17%, GOOGL $175.20 -0.45%, MSFT $425.10 +1.33%, AMZN $188.90 +0.64%, TSLA $245.30 -3.31%. Each shows symbol, price, change, and a trend badge." },
  { id: "data-table", label: "Data table", prompt: "Create an employee data table with search input, department dropdown filter, and a table with 8 rows showing: Name, Email, Department (Engineering/Design/Marketing/Sales), Role, Status (Active/On Leave). Add pagination showing page 1 of 3." },
  { id: "settings", label: "Settings panel", prompt: "Create a settings panel with Tabs for Profile, Notifications, Security. Show the Notifications tab with 6 toggle switches: Email alerts, Push notifications, Marketing emails, Weekly digest, Security alerts, Product updates." },
  { id: "checkout", label: "Checkout", prompt: "Create a checkout form with shipping address fields (name, street, city, state, zip), shipping method radio group (Standard free, Express $12.99), payment fields (card number, expiry, CVC), and an order summary showing 3 items totaling $247.00" },
  { id: "kanban", label: "Kanban board", prompt: "Create a kanban board with 3 columns: To Do (3 cards), In Progress (2 cards), Done (2 cards). Each card has a title, priority badge (high/medium/low), and assignee name. Use realistic task names." },
  { id: "charts", label: "Charts dashboard", prompt: "Create a charts dashboard with a 2x2 grid: a line chart of monthly revenue (6 months), a bar chart of sales by region (4 regions), a pie chart of traffic sources (Direct 35%, Organic 28%, Social 20%, Referral 17%), and a stat card showing total revenue $1.2M" },
  { id: "user-profile", label: "User profile", prompt: "Create a user profile page with an avatar, name (Jane Cooper), role (Product Designer), bio, stats row (142 Projects, 28 Teams, 4.9 Rating), and a list of 4 recent projects with title, date, and status badge" },
  { id: "notifications", label: "Notification feed", prompt: "Create a notification feed with a heading showing 5 unread, and 6 notification items. Each has an avatar, title, description, timestamp. Mix types: comment, mention, team invite, deploy success, review request, billing alert." },
  { id: "file-upload", label: "File upload", prompt: "Create a file upload form with a drag-and-drop zone, a list of 3 uploaded files (report.pdf 2.4MB, photo.jpg 1.1MB, data.csv 340KB) each with a progress bar and remove button, and an Upload All button" },
  { id: "onboarding", label: "Onboarding wizard", prompt: "Create a 4-step onboarding wizard showing step 2 of 4. Step indicator at top (Personal Info done, Company Details active, Preferences upcoming, Review upcoming). Form fields: Company Name, Industry dropdown, Company Size radio group (1-10/11-50/51-200/200+), Website URL. Back and Continue buttons." },

  // ── Production-grade scenarios (json-render.dev / OpenUI style) ──

  { id: "ai-chat", label: "AI chat interface", prompt: "Create a full AI chat interface. Left sidebar with: a 'New Chat' button, a search input for conversations, and a list of 6 past conversations (e.g. 'Debug React hooks', 'SQL query help', 'Write unit tests') each showing title and relative timestamp. Main area has a heading 'Claude Assistant' with a model selector dropdown (Sonnet/Opus/Haiku). Message thread with 4 messages alternating user/assistant. The first user message asks 'How do I debounce in React?'. The assistant reply includes a paragraph of explanation, then a Card with a code block showing a useDebounce hook implementation (use a TextArea with monospace styling and ~8 lines of code as text content). Second user message asks 'Can you add TypeScript types?'. Second assistant reply has another explanation paragraph and another code Card with the typed version. Below the thread show a typing indicator with 3 animated dots and the text 'Claude is thinking...'. At the bottom, an Input for the message with placeholder 'Send a message...', a Select for temperature (0/0.5/1.0), and a send Button." },

  { id: "analytics-dashboard", label: "Analytics dashboard", prompt: "Create a comprehensive analytics dashboard. Top nav bar with: app name 'Acme Analytics', navigation tabs (Overview, Customers, Products, Revenue), a search Input, and an Avatar with 'JD'. Left sidebar with icon menu items: Dashboard (active), Reports, Segments, Funnels, Cohorts, Settings, each with an Icon and label. Main content area starts with a heading 'Dashboard Overview' and a date range text 'Jan 1 - Mar 31, 2025'. Row of 4 stat Cards: Total Revenue $128,430 with Badge '+14.2%', Active Users 24,521 with Badge '+7.8%', Conversion Rate 3.42% with Badge '-0.3%', Avg Order Value $52.30 with Badge '+2.1%'. Below that a Grid with 2 columns: a LineChart titled 'Revenue Trend' with 12 monthly data points from $82K to $128K, and a BarChart titled 'Sales by Channel' with 5 bars (Direct $45K, Organic $32K, Paid $28K, Social $15K, Referral $8K). Below the charts, a Card titled 'Recent Transactions' containing a Table with columns: Transaction ID, Customer, Amount, Status, Date. Include 8 rows with realistic data, statuses as Badges (Completed green, Pending yellow, Refunded red). Below the table, a pagination row showing 'Page 1 of 12' with Previous/Next buttons." },

  { id: "email-template", label: "Email template builder", prompt: "Create a marketing email template layout. Container with max width styling. Header section with an Image logo placeholder and navigation Links (Products, Blog, Pricing, Support). Hero section: large Heading 'Ship Faster with AI-Powered Dev Tools', subheading Text 'Join 50,000+ developers who write better code in half the time', a prominent Button 'Start Free Trial', and small Text 'No credit card required'. Feature grid section with heading 'Everything You Need' and a 2x3 Grid of 6 feature Cards, each with an Icon, bold title, and description: 'Smart Autocomplete' (AI predictions as you type), 'Code Review' (Automated PR analysis), 'Test Generation' (One-click unit tests), 'Documentation' (Auto-generated docs), 'Refactoring' (Intelligent code transforms), 'Security Scan' (Vulnerability detection). Testimonial section: a Card with italic quote text '\"This tool cut our sprint velocity in half. The AI suggestions are genuinely useful, not just autocomplete.\"', Avatar, name 'Sarah Chen', role 'CTO at Vercel'. Pricing comparison section with heading 'Simple Pricing' and 3 Cards side by side: Hobby ($0/mo, 5 features, 'Get Started' button), Pro ($29/mo with 'Popular' Badge, 8 features, 'Start Trial' button), Team ($79/seat/mo, 10 features, 'Contact Sales' button). Stats row: 4 stat items in a row: '50K+' Developers, '2M+' Completions/day, '99.9%' Uptime, '4.9/5' Rating. Footer with 4 columns of Links (Product, Company, Resources, Legal), Divider, and copyright Text." },

  { id: "fintech-copilot", label: "Fintech portfolio copilot", prompt: "Create a fintech portfolio copilot dashboard. Top bar with heading 'WealthPilot' and tabs: Portfolio, Watchlist, Transactions, Research. Right side has Avatar 'MK' and a Bell icon with Badge '3'. Summary row of 5 stat Cards: Total Value $847,293.41 with Badge '+$12,847 today', Day Change +1.54% (green Badge), Total Return +34.2% with text 'since Jan 2023', Cash Balance $23,450.00, and Buying Power $46,900.00. Main area has 2 columns. Left column (wider): a Card titled 'Holdings' with a Table: columns Ticker, Name, Shares, Avg Cost, Current Price, Day Change, Total Return, Value. 8 rows of real stocks: AAPL (150 shares, $142.50, $198.23, +1.2%, +39.1%, $29,734), MSFT (85 shares, $310.00, $425.80, +0.8%, +37.4%, $36,193), GOOGL (60 shares, $125.00, $175.40, -0.3%, +40.3%, $10,524), NVDA (40 shares, $450.00, $890.50, +2.1%, +97.9%, $35,620), AMZN (45 shares, $145.00, $188.90, +0.5%, +30.3%, $8,500), META (55 shares, $300.00, $510.75, +1.8%, +70.3%, $28,091), JPM (70 shares, $150.00, $198.40, +0.4%, +32.3%, $13,888), V (50 shares, $240.00, $282.30, +0.6%, +17.6%, $14,115). Below that an AreaChart titled 'Portfolio Performance (1Y)' with 12 monthly data points from $632K to $847K. Right column: a PieChart titled 'Sector Allocation' with slices Technology 52%, Financial 16%, Healthcare 12%, Consumer 11%, Energy 9%. Below that a Card titled 'Recent Activity' with a List of 6 transactions: 'Bought 10 NVDA @ $885.20', 'Sold 20 TSLA @ $245.30', 'Dividend: AAPL $47.25', 'Bought 15 AMZN @ $186.50', 'Sold 5 META @ $505.00', 'Bought 25 JPM @ $196.80', each with date and amount." },

  { id: "3d-scene-config", label: "3D scene configurator", prompt: "Create a 3D scene configurator panel layout. Left sidebar titled 'Scene Hierarchy' with a tree-like List of scene objects using indentation: 'Scene Root', then indented children: 'Main Camera' with Icon, 'Directional Light' with Icon, 'Environment' with Icon (containing indented children: 'Ground Plane', 'Sky Dome'), 'Characters' with Icon (containing: 'Player Model' with active Badge, 'NPC Guard', 'NPC Merchant'), 'Props' with Icon (containing: 'Treasure Chest', 'Barrel', 'Crate x3'). Each item has a visibility Toggle and select highlight. Center area has a large placeholder Card labeled '3D Viewport' with text 'WebGL Render Preview' and a toolbar row below it with Buttons: Translate, Rotate, Scale (with Translate active), a Divider, then Wireframe Toggle, Grid Toggle, and a Select for shading mode (Solid/Material/Rendered). Right sidebar titled 'Properties' for the selected 'Player Model' object. Transform section: 3 rows of 3 Inputs each for Position (X: 2.5, Y: 0, Z: -1.3), Rotation (X: 0, Y: 45, Z: 0), Scale (X: 1, Y: 1, Z: 1). Material section: a Select for shader (PBR Standard), color Input (Albedo: #4A90D9), Sliders for Metallic (0.3), Roughness (0.7), and Normal Strength (1.0). Animation section: a Select for current clip ('Idle'), Play/Pause/Stop Buttons, a Slider for playback speed (1.0x), and a Checkbox for Loop. Bottom panel: a timeline bar labeled 'Timeline' with frame counter Text '0 / 120 frames', a Slider representing the playback scrubber, and row of keyframe markers at frames 0, 30, 60, 90, 120." },

  { id: "video-editor", label: "Video editor timeline", prompt: "Create a video editor interface. Top toolbar with Buttons: Import, Cut, Split, Delete, Undo, Redo. Then a Divider, followed by a Select for export quality (720p/1080p/4K) and an 'Export' Button with Icon. Main area split into 2 sections. Left section (wider): a large Card titled 'Preview' with centered placeholder Text 'Video Preview Area' and dimensions text '1920x1080'. Below the preview, playback controls in a row: a rewind Button, play/pause Button (large), fast-forward Button, a Slider for the scrubber, and time Text '01:23:45 / 04:12:00'. Volume Icon with a small Slider. Right section: a Card titled 'Inspector' with Tabs for Clip, Effects, Audio. Show the Effects tab with: a Select for 'Add Effect', and a List of applied effects: 'Color Correction' with a Switch (on) and Sliders for Brightness (0.1), Contrast (1.2), Saturation (1.1); 'Blur' with a Switch (off) and a Slider for Radius (5px); 'Fade In' with a Switch (on) and an Input for Duration (0.5s). Bottom section: a Card titled 'Timeline' with a time ruler Text showing markers at 0:00, 1:00, 2:00, 3:00, 4:00. Four horizontal tracks stacked vertically: 'V2 - Overlay' track with 1 clip Card (Title Card, 0:00-0:15) with Badge; 'V1 - Main' track with 3 clip Cards (Intro 0:00-0:45, Interview 0:45-2:30, B-Roll 2:30-3:15) each as a Card with different colored Badges; 'A1 - Dialog' track with 2 clip Cards (Interview Audio 0:45-2:30, Voiceover 2:30-3:45); 'A2 - Music' track with 1 clip Card (Background Music 0:00-4:12). Each track has a label, mute Toggle, and lock Toggle." },

  { id: "mobile-order", label: "Mobile order tracker", prompt: "Create a mobile order tracking screen inside a phone frame. The outer container should be a Card styled to look like a phone (narrow width, rounded). Top status bar with Text showing '9:41 AM' on the left, and battery/signal icons as Text on the right. App header with a back arrow Button, heading 'Order #4821', and a help Icon button. Order status section: a Stepper component with 4 steps: 'Confirmed' (completed, with check), 'Preparing' (completed, with check), 'Out for Delivery' (active/current, highlighted), 'Delivered' (upcoming). Below the stepper, a Card with delivery info: 'Estimated Arrival' as label with bold text '12:30 - 12:45 PM', a Progress bar at 65%, and Text 'Your driver Alex is 2.3 miles away'. Map placeholder Card with Text 'Live Map View' centered. Items section with heading 'Order Items' and a List of 4 items: 'Margherita Pizza (Large)' with 'x1' Badge and '$18.99', 'Caesar Salad' with 'x1' Badge and '$12.50', 'Garlic Breadsticks' with 'x2' Badge and '$8.99', 'Sparkling Water' with 'x2' Badge and '$5.98'. Each item has a small Image placeholder. Order summary Card: Subtotal $46.46, Delivery Fee $4.99, Tax $3.72, a Divider, then Total $55.17 in bold. Tip section with 4 small Buttons: $3, $5, $7, Custom. Bottom action: a large Button 'Contact Driver' and a Link 'Report an Issue'." },

  { id: "canvas-workspace", label: "Canvas workspace", prompt: "Create a canvas workspace / whiteboard interface. Top toolbar: app title Text 'BoardFlow', Divider, tool Buttons in a row (Select/cursor, Pen, Rectangle, Circle, Text, Sticky Note, Connector/Arrow, Eraser) with Select as active, Divider, zoom controls (minus Button, Text '100%', plus Button, 'Fit' Button), Divider, 'Share' Button and Avatar stack showing 3 Avatars (AL, MK, JS) with a Badge '+2'. Left sidebar titled 'Pages' with a List of 5 pages: 'Sprint Planning' (active/selected), 'Architecture Diagram', 'User Flow', 'Wireframes', 'Retrospective', plus an 'Add Page' Button. Main canvas area as a large Card. Inside, position several elements to simulate a whiteboard: a Card styled as a sticky note with text 'Refactor auth module' and Badge 'P1', another sticky 'Add rate limiting' with Badge 'P2', another 'Update API docs' with Badge 'P3', a Card styled as a text block with heading 'Sprint 24 Goals', a Card containing a small List ('Migrate to v2 API', 'Fix memory leak in worker', 'Ship onboarding redesign', 'Load testing'). Right sidebar titled 'Properties' for selected sticky note element: Input for Text content ('Refactor auth module'), Select for Color (Yellow/Blue/Green/Pink/Orange), Select for Size (Small/Medium/Large), Input for Author ('Alex L.'), DatePicker for Due Date, Select for Priority (P1/P2/P3), Checkbox for 'Lock position', and a 'Delete' Button in red." },

  { id: "search-results", label: "AI search results", prompt: "Create an AI-powered search results page. Top section: a large heading 'SearchAI', a prominent search Input with value 'best practices for React server components' and a search Button. Below the search bar, filter tabs: All (active), Articles, Videos, Docs, Discussions. AI Summary Card with a sparkle Icon and heading 'AI Overview': 3 paragraphs of realistic summary text about React Server Components best practices including when to use them (data fetching, large dependencies, server-only code), when to avoid (interactivity, browser APIs, state management), and key patterns (composition with client components, streaming with Suspense). The card has a 'Sources' section listing 3 Links with favicons as Text. Below, 6 search result Cards, each with: a small Text for the URL domain, a Link heading as the title, a description Text (2-3 lines), and a row with star rating (e.g. Text showing stars), review count Badge, and date Text. Results should be realistic: 'React Server Components - Official Docs' (react.dev), 'Understanding RSC Architecture' (blog post), 'Server Components Deep Dive - Video' (youtube), 'RSC vs SSR: Key Differences' (dev.to), 'Migrating to Server Components' (medium), 'RSC Performance Benchmarks' (github). After results, a 'People Also Ask' Card with 4 expandable items (just show as a List): 'What is the difference between RSC and SSR?', 'Can you use hooks in server components?', 'How do server components affect bundle size?', 'When should I use client components?'. Finally, a Card titled 'Related Searches' with a Grid of 6 Badges/Links: 'Next.js app router', 'React streaming SSR', 'RSC data fetching', 'Server actions', 'React Suspense', 'Partial prerendering'." },

  { id: "terminal-cli", label: "Terminal CLI output", prompt: "Create a terminal/CLI interface. Outer Card styled dark (like a terminal window). Title bar row with 3 small colored Badges (red, yellow, green) as window controls, and Text 'bash ~ toon-benchmark' as the terminal title. Terminal content area with monospace-styled content. Show a command history of 6 commands with outputs. Command 1: Text '$ toon generate --input dashboard.json --format toon' followed by output lines: 'Reading input... 2.4 KB JSON', 'Parsing 14 components...', 'Converting to TOON format...', 'Output: dashboard.toon (1.1 KB)', with a final line 'Compression: 54% token reduction' in green Badge style. Command 2: '$ toon validate dashboard.toon' with output 'Validating TOON syntax... All 14 components valid' with a green check. Command 3: '$ toon benchmark --runs 100 --model sonnet' with a Table output: columns Format, Avg Tokens, P50 Latency, P99 Latency, Cost. Two rows: JSON (3,847 tokens, 1.2s, 2.1s, $0.048) and TOON (1,723 tokens, 0.7s, 1.3s, $0.022). Below the table a Text line 'TOON: 55.2% fewer tokens, 41.7% faster, 54.2% cheaper'. Command 4: '$ toon render dashboard.toon --preview' with output 'Starting preview server on http://localhost:3000' and 'Rendering 14 components...', then 'Preview ready' with a green Badge. Command 5: '$ toon diff dashboard.json dashboard.toon --stats' with a compact stats output: 'Lines: 142 -> 47 (66.9% reduction)', 'Characters: 3,891 -> 1,204 (69.1% reduction)', 'Nesting depth: 8 -> 4 (50% reduction)'. Command 6: '$ echo \"Ready to ship\"' with output 'Ready to ship'. At the bottom, show a blinking cursor line '$ ' to indicate the terminal is ready for input." },
];

async function generate(prompt: string, format: "json" | "toon"): Promise<{ text: string; tokens: number }> {
  const sys = format === "json" ? JSON_SYS : TOON_SYS;
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: sys,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { text, tokens: res.usage.output_tokens };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set in .env");
    process.exit(1);
  }

  console.log(`Generating ${DEMOS.length} demos with ${MODEL}...\n`);

  const results: Record<string, { label: string; prompt: string; json: string; toon: string; jsonTokens: number; toonTokens: number }> = {};

  for (const demo of DEMOS) {
    process.stdout.write(`  ${demo.id}...`);
    const [j, t] = await Promise.all([
      generate(demo.prompt, "json"),
      generate(demo.prompt, "toon"),
    ]);
    results[demo.id] = {
      label: demo.label,
      prompt: demo.prompt,
      json: j.text,
      toon: t.text,
      jsonTokens: j.tokens,
      toonTokens: t.tokens,
    };
    const sv = ((1 - t.tokens / j.tokens) * 100).toFixed(0);
    console.log(` json:${j.tokens} toon:${t.tokens} (${sv}% saved)`);
  }

  // Write as JS for the landing page
  const outPath = resolve(__dirname, "../../../docs/demos.js");
  const js = `// Auto-generated demo data. Do not edit.\n// Generated with ${MODEL} on ${new Date().toISOString().split("T")[0]}\nconst DEMOS = ${JSON.stringify(results, null, 2)};\n`;
  writeFileSync(outPath, js);
  console.log(`\nWrote ${outPath}`);

  // Summary
  let totalJ = 0, totalT = 0;
  for (const r of Object.values(results)) { totalJ += r.jsonTokens; totalT += r.toonTokens; }
  console.log(`Total: JSON ${totalJ} tokens, TOON ${totalT} tokens (${((1 - totalT / totalJ) * 100).toFixed(0)}% savings)`);
}

main().catch(console.error);
