# toon-json-render

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/typescript-5.8%2B-blue.svg)]()

TOON adapter for [json-render](https://github.com/vercel-labs/json-render). Encodes the current flat spec in TOON for fewer tokens.

**[Live demos and benchmarks](https://abhishekgahlot2.github.io/toon-json-render/)**

## Why this combo

Teams evaluating model-generated UI usually end up in one of three places:

- Raw `json-render`: explicit, inspectable, and JSON-native, but verbose for LLM output.
- `OpenUI`: more compact, but it introduces a new language and authoring surface.
- `TOON + json-render`: keeps the same flat `json-render` contract while reducing transport cost.

`TOON + json-render` is the pragmatic middle path:

- More efficient than raw JSON
- Less disruptive than introducing a new DSL
- Reversible back to canonical `json-render`
- Easy to adopt incrementally in an existing `json-render` pipeline

The goal is not to replace `json-render`. The goal is to keep `json-render` as the application contract while sending less text through the model.

## What this does

json-render uses a flat JSON spec to describe UIs:

```json
{
  "root": "card",
  "state": { "form": { "name": "", "email": "" } },
  "elements": {
    "card": { "type": "Card", "props": { "title": "Contact" }, "children": ["nameInput", "submitBtn"] },
    "nameInput": { "type": "Input", "props": { "label": "Name", "value": { "$bindState": "/form/name" } } },
    "submitBtn": { "type": "Button", "props": { "label": "Send" }, "on": { "press": { "action": "validateForm" } } }
  }
}
```

That JSON has a lot of repeated structure. TOON encodes the same spec more compactly:

```
root: card
state:
  form:
    name:
    email:
elements:
  card:
    type: Card
    props:
      title: Contact
    children: [2]: nameInput	submitBtn
  nameInput:
    type: Input
    props:
      label: Name
      value:
        $bindState: /form/name
  submitBtn:
    type: Button
    props:
      label: Send
    on:
      press:
        action: validateForm
```

Same data, fewer tokens. TOON uses indentation instead of braces, skips redundant quoting, and collapses arrays. It decodes back to identical JSON.

This project provides the encoder/decoder, prompt builder, stream compiler, and React renderer to wire TOON into json-render's pipeline.

## Flat-spec compatibility

We target the current flat `json-render` shape:

- `root` / `state` / `elements` top-level structure
- Flat element map with string key references
- `type`, `props`, `children` per element
- `$state`, `$bindState` for reactive data binding
- `$item`, `$index` for repeat iteration
- `on` event handlers (press, change, submit, focus, blur)
- `visible` conditions with comparison operators
- `repeat` for iterating over state arrays
- Built-in actions: `setState`, `pushState`, `removeState`, `validateForm`

## Install

```sh
pnpm add @toon-json-render/core @toon-json-render/react
```

## Packages

`@toon-json-render/core` - Decoder with 4-pass error recovery, prompt builder for the flat spec, stream compiler, validation.

`@toon-json-render/react` - `<ToonRenderer>` component and `useToonStream` hook.

## Usage

Render TOON from an LLM:

```tsx
import { ToonRenderer } from "@toon-json-render/react";

const components = { Card, Button, Input, Table };

function App({ llmOutput }: { llmOutput: string }) {
  return <ToonRenderer toon={llmOutput} components={components} />;
}
```

Build prompts that teach the LLM the json-render flat spec format:

```ts
import { generateSystemPrompt } from "@toon-json-render/core";

const prompt = generateSystemPrompt({
  components: [
    { name: "Card", props: { title: { type: "string" } } },
    { name: "Input", props: { label: { type: "string" }, value: { type: "string" } } },
    { name: "Button", props: { label: { type: "string" }, variant: { type: "string", enum: ["primary", "secondary"] } } },
  ],
}, { compact: true });
```

Stream compiler for progressive rendering:

```ts
import { ToonStreamCompiler } from "@toon-json-render/core";

const compiler = new ToonStreamCompiler({
  skeletonFirst: true,
  catalog: ["Card", "Button", "Input"],
  jsonFallback: true,
});

for await (const chunk of llmStream) {
  const patches = compiler.push(chunk);
  if (patches.length) applyToUI(patches);
}

const { spec, errors } = compiler.finalize();
```

## How decoding works

```
Catalog -> TOON Prompt -> LLM -> TOON Stream -> Recovery Decoder -> json-render -> UI
```

LLMs mess up TOON's `[N]` array length headers. The decoder tries four passes:

1. Strict decode
2. Repair `[N]` headers to match actual counts, strict decode
3. Same repair, lenient decode
4. Lenient decode on original

Falls back to JSON parsing if all four fail.

## Benchmarks

Current canonical head-to-head benchmark on Claude Sonnet 4 across 7 scenarios:

- JSON: `6491` output tokens
- TOON: `4745` output tokens (`26.9%` fewer than JSON)
- OpenUI: `3843` output tokens (`40.8%` fewer than JSON)
- Validity: `7/7` for JSON, TOON, and OpenUI

Interpretation:

- raw `json-render` is the easiest baseline to understand, but the most verbose
- `OpenUI` wins on raw compactness
- `TOON + json-render` keeps the canonical JSON-native spec while still cutting token cost materially

So this project is best for teams that want a better compatibility-to-efficiency tradeoff, not for teams optimizing only for absolute minimum tokens.

Run them yourself:

```sh
git clone https://github.com/abhishekgahlot2/toon-json-render.git
cd toon-json-render
echo "ANTHROPIC_API_KEY=your-key" > .env
pnpm install && pnpm build

pnpm benchmark                                                 # TOON vs JSON (7 scenarios)
pnpm --filter @toon-json-render/benchmark run bench:opt        # 4-way with compact mode
pnpm --filter @toon-json-render/benchmark run bench:complex    # 10 complex UI scenarios
pnpm --filter @toon-json-render/benchmark run bench:real       # 12 production UI scenarios
```

## Development

```sh
pnpm install
pnpm build
pnpm test
```

## Related Work

For a focused `TOON vs JSONL` benchmark around `json-render`, see
[mateolafalce/benchmark-json-render](https://github.com/mateolafalce/benchmark-json-render).

That repo is useful for:

- benchmarking two implementations side by side
- tracking tokens, cost, and latency together
- running the same prompt corpus across both variants

This project takes a broader comparison route by benchmarking canonical flat `json-render`, `TOON + json-render`, and `OpenUI` on the same scenario set.

## License

MIT
