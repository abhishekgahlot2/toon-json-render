import { encode } from "@toon-format/toon";

export interface ComponentDef {
  name: string;
  description?: string;
  props?: Record<string, PropDef>;
  children?: boolean;
}

export interface PropDef {
  type: string;
  description?: string;
  required?: boolean;
  enum?: string[];
}

export interface ActionDef {
  name: string;
  description?: string;
  params?: Record<string, PropDef>;
}

export interface CatalogConfig {
  components: ComponentDef[];
  actions?: ActionDef[];
}

export interface PromptOptions {
  /** Use compact catalog (names + prop keys only, no descriptions) */
  compact?: boolean;
  /** Include a few-shot example showing expected output */
  includeExample?: boolean;
}

// ---------------------------------------------------------------------------
// Encoder-generated flat-spec examples with data binding
// ---------------------------------------------------------------------------

/** Contact form: state, $bindState, event handlers, validateForm action */
const EXAMPLE_CONTACT_FORM = {
  root: "card",
  state: { form: { name: "", email: "" } },
  elements: {
    card: {
      type: "Card",
      props: { title: "Contact" },
      children: ["nameField", "emailField", "submitBtn"],
    },
    nameField: {
      type: "Input",
      props: { label: "Name", value: { $bindState: "/form/name" } },
    },
    emailField: {
      type: "Input",
      props: {
        label: "Email",
        type: "email",
        value: { $bindState: "/form/email" },
      },
    },
    submitBtn: {
      type: "Button",
      props: { label: "Submit" },
      on: { press: { action: "validateForm" } },
    },
  },
};

/** Todo list: repeat, $item, $index, $bindItem, pushState, removeState, visible */
const EXAMPLE_TODO_LIST = {
  root: "page",
  state: { todos: [{ id: "todo-1", text: "Buy milk", done: false }], newTodo: "" },
  elements: {
    page: {
      type: "Stack",
      props: { spacing: "md" },
      children: ["heading", "addRow", "todoList", "clearBtn"],
    },
    heading: {
      type: "Text",
      props: { text: "My Todos", variant: "h2" },
    },
    addRow: {
      type: "Stack",
      props: { direction: "row", spacing: "sm" },
      children: ["todoInput", "addBtn"],
    },
    todoInput: {
      type: "Input",
      props: {
        placeholder: "New todo...",
        value: { $bindState: "/newTodo" },
      },
    },
    addBtn: {
      type: "Button",
      props: { label: "Add" },
      on: {
        press: {
          action: "pushState",
          params: {
            statePath: "/todos",
            value: { id: "$id", text: { $state: "/newTodo" }, done: false },
            clearStatePath: "/newTodo",
          },
        },
      },
    },
    todoList: {
      type: "Stack",
      repeat: { statePath: "/todos", key: "id" },
      children: ["todoItem"],
    },
    todoItem: {
      type: "Checkbox",
      props: {
        label: { $item: "/text" },
        checked: { $bindItem: "done" },
      },
    },
    clearBtn: {
      type: "Button",
      props: { label: "Clear completed", variant: "secondary" },
      visible: { $state: "/todos" },
      on: {
        press: {
          action: "setState",
          params: {
            statePath: "/todos",
            value: [],
          },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a TOON-aware system prompt for the current json-render flat spec.
 *
 * Teaches the model the flat element-map format with `root`, `state`,
 * `elements`, data-binding expressions (`$state`, `$bindState`, `$item`,
 * `$index`), event handlers (`on`), conditional rendering (`visible`),
 * list iteration (`repeat`), and built-in actions.
 *
 * Uses encoder-generated examples so the model imitates the exact
 * compact form the decoder expects.
 */
export function generateSystemPrompt(
  catalog: CatalogConfig,
  options: PromptOptions = {},
): string {
  const { compact = false, includeExample = true } = options;

  const catalogEncoded = compact
    ? generateCompactCatalog(catalog)
    : encode(catalog);

  // Encoder-generated examples
  const contactToon = encode(EXAMPLE_CONTACT_FORM);
  const contactJson = JSON.stringify(EXAMPLE_CONTACT_FORM, null, 2);
  const todoToon = encode(EXAMPLE_TODO_LIST);

  let prompt = `You generate UIs in the current json-render flat spec encoded as TOON.

Catalog:
${catalogEncoded}

--- json-render flat spec format ---

The output is a flat element map, NOT a nested component tree.

Top-level keys:
  root   – string key of the root element
  state  – initial state object (optional)
  elements – flat map of elementKey → element definition

Each element has:
  type       – component name from the catalog
  props      – component properties (optional)
  children   – array of element KEY STRINGS referencing other entries in elements (optional)
  on         – event handlers: { eventName: { action, ...params } } (optional)
  visible    – conditional expression; element renders only when truthy (optional)
  repeat     – list iteration: { statePath: "/items", key: "id" } (optional)

Data binding expressions (used inside props, on, visible, repeat):
  { "$state": "/path" }      – read value from state
  { "$bindState": "/path" }  – two-way bind (read + write) for form inputs
  { "$item": "field" } or { "$item": "/field" } – current item field inside a repeat block
  { "$bindItem": "field" }   – two-way bind to a field on the current repeat item
  { "$index": true }         – current iteration index inside a repeat block

Built-in actions (used in on handlers):
  setState     – set value at a state path: { action: "setState", params: { statePath: "/x", value: ... } }
  pushState    – push item to array at state path: { action: "pushState", params: { statePath: "/arr", value: ..., clearStatePath?: "/draft" } }
  removeState  – remove an array item by index: { action: "removeState", params: { statePath: "/arr", index: N } }
  validateForm – validate all $bindState bindings: { action: "validateForm" }

--- TOON encoding rules ---

- Indentation replaces braces/brackets.
- Use minimal quoting (quote only when value contains special chars).
- [N] declares the exact number of array items that follow.
- Prefer tabular [N]{field1,field2}: form for arrays of objects whenever field shapes are regular.
- Count array items carefully before writing [N].
- Recount inline arrays, list arrays, and nested arrays before finishing the output.
- If you write [3], exactly 3 inline values, 3 list items, or 3 tabular rows must follow.
- Omit optional fields (props, children, on, visible, repeat) when not used.`;

  if (includeExample) {
    prompt += `

--- Example 1: Contact form (TOON) ---
${contactToon}

--- Example 1: Contact form (equivalent JSON for reference) ---
${contactJson}

--- Example 2: Todo list with repeat, visible, item binding (TOON) ---
${todoToon}

Array counting reminders:
- children[3] must be followed by exactly 3 comma-separated key strings.
- In state, todos[1]{text,done}: declares 1 tabular row with 2 fields.
- Prefer short, stable element keys such as root, hdr, card1, btn1, row1 unless longer names are needed for clarity.
- Omit props that are only restating obvious component defaults from the catalog or renderer.
- Count the items first, then write the [N] header. Never guess.`;
  }

  prompt += `

Output ONLY valid TOON. No markdown fences, no JSON, no explanations.`;

  return prompt;
}

/**
 * Generate a TOON example showing the expected flat-spec output format.
 * Uses the encoder to produce the exact compact form.
 */
export function generateExample(spec: Record<string, unknown>): string {
  return encode(spec);
}

/**
 * Create a compact catalog summary for token-constrained contexts.
 * Keeps component names, prop keys, enums, required flags, and actions.
 * Drops descriptions for maximum token efficiency.
 */
export function generateCompactCatalog(catalog: CatalogConfig): string {
  const compactComponents = catalog.components.map((c) => {
    const entry: Record<string, unknown> = { name: c.name };
    if (c.props) {
      const propSummary: Record<string, unknown> = {};
      for (const [key, def] of Object.entries(c.props)) {
        if (def.enum) {
          propSummary[key] = def.enum;
        } else if (def.required) {
          propSummary[key] = def.type + "*";
        } else {
          propSummary[key] = def.type;
        }
      }
      entry.props = propSummary;
    }
    if (c.children) entry.children = true;
    return entry;
  });

  const result: Record<string, unknown> = { components: compactComponents };

  if (catalog.actions && catalog.actions.length > 0) {
    result.actions = catalog.actions.map((a) => {
      const entry: Record<string, unknown> = { name: a.name };
      if (a.params) {
        const paramSummary: Record<string, unknown> = {};
        for (const [key, def] of Object.entries(a.params)) {
          if (def.required) {
            paramSummary[key] = def.type + "*";
          } else {
            paramSummary[key] = def.type;
          }
        }
        entry.params = paramSummary;
      }
      return entry;
    });
  }

  return encode(result);
}
