export interface JsonRenderSpec {
  component: string;
  props?: Record<string, unknown>;
  children?: JsonRenderSpec[];
}

export interface FlatElementSpec {
  type: string;
  props?: Record<string, unknown>;
  children?: string[];
  visible?: unknown;
  repeat?: {
    statePath?: string;
    key?: string;
    source?: unknown;
    over?: unknown;
    as?: string;
    indexAs?: string;
  };
  on?: Record<string, unknown>;
}

export interface FlatJsonRenderSpec {
  root: string;
  state?: Record<string, unknown>;
  elements: Record<string, FlatElementSpec>;
}

export type DecodedJsonRender =
  | JsonRenderSpec
  | JsonRenderSpec[]
  | FlatJsonRenderSpec;

interface FlatElementLike {
  type?: unknown;
  t?: unknown;
  props?: unknown;
  p?: unknown;
  children?: unknown;
  c?: unknown;
  visible?: unknown;
  v?: unknown;
  repeat?: unknown;
  rp?: unknown;
  on?: unknown;
  o?: unknown;
}

interface FlatRepeatLike {
  statePath?: unknown;
  sp?: unknown;
  key?: unknown;
  k?: unknown;
  source?: unknown;
  over?: unknown;
  as?: unknown;
  indexAs?: unknown;
}

interface ResolveContext {
  state: Record<string, unknown>;
  item?: unknown;
  index?: number;
  aliases?: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isTreeSpec(value: unknown): value is JsonRenderSpec {
  const record = asRecord(value);
  return record !== null && typeof record.component === "string";
}

export function normalizeFlatSpec(value: unknown): FlatJsonRenderSpec | null {
  const record = asRecord(value);
  if (!record) return null;

  const root = record.root ?? record.r;
  const elements = record.elements ?? record.e;
  const state = (record.state ?? record.s) as Record<string, unknown> | undefined;
  const elementMap = asRecord(elements);

  if (typeof root !== "string" || !elementMap) return null;

  const normalizedElements: Record<string, FlatElementSpec> = {};
  for (const [key, rawElement] of Object.entries(elementMap)) {
    const element = asRecord(rawElement) as FlatElementLike | null;
    if (!element) return null;

    const type = element.type ?? element.t;
    if (typeof type !== "string") return null;

    const repeatLike = asRecord((element.repeat ?? element.rp) as unknown) as FlatRepeatLike | null;
    const repeat = repeatLike
      ? {
          statePath:
            typeof (repeatLike.statePath ?? repeatLike.sp) === "string"
              ? String(repeatLike.statePath ?? repeatLike.sp)
              : undefined,
          key:
            typeof (repeatLike.key ?? repeatLike.k) === "string"
              ? String(repeatLike.key ?? repeatLike.k)
              : undefined,
          source: repeatLike.source,
          over: repeatLike.over,
          as: typeof repeatLike.as === "string" ? repeatLike.as : undefined,
          indexAs: typeof repeatLike.indexAs === "string" ? repeatLike.indexAs : undefined,
        }
      : undefined;

    normalizedElements[key] = {
      type,
      props: asRecord(element.props ?? element.p) ?? undefined,
      children: Array.isArray(element.children ?? element.c)
        ? (element.children ?? element.c) as string[]
        : undefined,
      visible: element.visible ?? element.v,
      repeat,
      on: asRecord(element.on ?? element.o) ?? undefined,
    };
  }

  return {
    root,
    state: asRecord(state) ?? undefined,
    elements: normalizedElements,
  };
}

export function isFlatSpec(value: unknown): value is FlatJsonRenderSpec {
  return normalizeFlatSpec(value) !== null;
}

export function getByPath(value: unknown, path: string): unknown {
  if (!path) return value;

  const parts = path.replace(/^\//, "").split("/").filter(Boolean);
  let current: unknown = value;

  for (const part of parts) {
    if (Array.isArray(current)) {
      current = current[Number(part)];
      continue;
    }

    const record = asRecord(current);
    if (!record) return undefined;
    current = record[part];
  }

  return current;
}

function normalizeAliasPath(path: string): string {
  return path.replace(/^\//, "");
}

function findAliasReference(record: Record<string, unknown>): {
  alias: string;
  path: string;
} | null {
  for (const [key, value] of Object.entries(record)) {
    if (!key.startsWith("$")) continue;
    if (
      key === "$state" ||
      key === "$bindState" ||
      key === "$item" ||
      key === "$bindItem" ||
      key === "$index" ||
      key === "$cond" ||
      key === "$then" ||
      key === "$else" ||
      key === "$and" ||
      key === "$or" ||
      key === "$template"
    ) {
      continue;
    }

    if (value === true) {
      return { alias: key, path: "" };
    }

    if (typeof value === "string") {
      return { alias: key, path: value };
    }
  }

  return null;
}

function resolveReferenceValue(
  record: Record<string, unknown>,
  ctx: ResolveContext,
): unknown {
  if (typeof record.$state === "string") return getByPath(ctx.state, record.$state);
  if (typeof record.$bindState === "string") return getByPath(ctx.state, record.$bindState);
  if (typeof record.$item === "string") return getByPath(ctx.item, normalizeAliasPath(record.$item));
  if (typeof record.$bindItem === "string") return getByPath(ctx.item, normalizeAliasPath(record.$bindItem));
  if (record.$index === true) return ctx.index;

  const aliasRef = findAliasReference(record);
  if (aliasRef && ctx.aliases?.[aliasRef.alias] !== undefined) {
    return getByPath(ctx.aliases[aliasRef.alias], normalizeAliasPath(aliasRef.path));
  }

  return undefined;
}

export function resolveValue(value: unknown, ctx: ResolveContext): unknown {
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, ctx));

  const record = asRecord(value);
  if (!record) return value;

  if (typeof record.$template === "string") {
    return record.$template.replace(/\$\{([^}]+)\}/g, (_, path: string) => {
      const resolved = getByPath(ctx.state, path);
      return resolved == null ? "" : String(resolved);
    });
  }

  const refValue = resolveReferenceValue(record, ctx);
  if (
    refValue !== undefined &&
    !("$cond" in record) &&
    !("$then" in record) &&
    !("$else" in record)
  ) {
    return refValue;
  }

  if ("$cond" in record) {
    const condition = evaluateVisible(record.$cond, ctx);
    return condition ? resolveValue(record.$then, ctx) : resolveValue(record.$else, ctx);
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, nested]) => [key, resolveValue(nested, ctx)]),
  );
}

export function evaluateVisible(condition: unknown, ctx: ResolveContext): boolean {
  if (typeof condition === "boolean") return condition;

  const record = asRecord(condition);
  if (!record) return Boolean(resolveValue(condition, ctx));

  if (Array.isArray(record.$and)) {
    return record.$and.every((entry) => evaluateVisible(entry, ctx));
  }

  if (Array.isArray(record.$or)) {
    return record.$or.some((entry) => evaluateVisible(entry, ctx));
  }

  const refValue = resolveReferenceValue(record, ctx);
  if ("eq" in record || "equals" in record) {
    return refValue === resolveValue(record.eq ?? record.equals, ctx);
  }
  if ("neq" in record || "notEquals" in record) {
    return refValue !== resolveValue(record.neq ?? record.notEquals, ctx);
  }
  if (record.not === true) return !Boolean(refValue);
  if (refValue !== undefined) return Boolean(refValue);

  return Boolean(resolveValue(condition, ctx));
}

function getRepeatItems(repeat: FlatElementSpec["repeat"], ctx: ResolveContext): unknown[] {
  if (!repeat) return [];

  if (typeof repeat.statePath === "string") {
    const items = getByPath(ctx.state, repeat.statePath);
    return Array.isArray(items) ? items : [];
  }

  const source = repeat.source ?? repeat.over;
  const resolved = resolveValue(source, ctx);
  return Array.isArray(resolved) ? resolved : [];
}

function buildRepeatAliases(
  repeat: FlatElementSpec["repeat"],
  item: unknown,
  index: number,
): Record<string, unknown> {
  const aliases: Record<string, unknown> = {};

  if (repeat?.as) {
    aliases[repeat.as.startsWith("$") ? repeat.as : `$${repeat.as}`] = item;
  }

  if (repeat?.indexAs) {
    aliases[repeat.indexAs.startsWith("$") ? repeat.indexAs : `$${repeat.indexAs}`] = index;
  }

  return aliases;
}

function expandElement(
  key: string,
  spec: FlatJsonRenderSpec,
  ctx: ResolveContext,
  ancestors: Set<string>,
): JsonRenderSpec | null {
  if (ancestors.has(key)) return null;

  const element = spec.elements[key];
  if (!element) return null;
  if (element.visible !== undefined && !evaluateVisible(element.visible, ctx)) return null;

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(key);

  const resolvedPropsRecord = asRecord(resolveValue(element.props ?? {}, ctx)) ?? {};
  const resolvedProps =
    Object.keys(resolvedPropsRecord).length > 0 ? resolvedPropsRecord : undefined;

  const children: JsonRenderSpec[] = [];
  const childKeys = element.children ?? [];

  if (element.repeat) {
    const items = getRepeatItems(element.repeat, ctx);
    items.forEach((item, index) => {
      const repeatAliases = buildRepeatAliases(element.repeat, item, index);
      const repeatCtx: ResolveContext = {
        ...ctx,
        item,
        index,
        aliases: {
          ...(ctx.aliases ?? {}),
          ...repeatAliases,
        },
      };

      childKeys.forEach((childKey) => {
        const child = expandElement(childKey, spec, repeatCtx, nextAncestors);
        if (child) children.push(child);
      });
    });
  } else {
    childKeys.forEach((childKey) => {
      const child = expandElement(childKey, spec, ctx, nextAncestors);
      if (child) children.push(child);
    });
  }

  return {
    component: element.type,
    props: resolvedProps,
    children: children.length > 0 ? children : undefined,
  };
}

export function toRenderableTree(
  value: DecodedJsonRender,
): JsonRenderSpec | JsonRenderSpec[] | null {
  if (Array.isArray(value)) return value.every(isTreeSpec) ? value : null;
  if (isTreeSpec(value)) return value;
  const normalized = normalizeFlatSpec(value);
  if (!normalized) return null;

  return expandElement(normalized.root, normalized, { state: normalized.state ?? {} }, new Set());
}
