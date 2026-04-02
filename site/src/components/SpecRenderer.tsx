import { useMemo } from "react";
import {
  Card, CardBody, CardHeader,
  Button, Input, Textarea, Select, SelectItem,
  Checkbox, Switch, Chip, Divider, Avatar,
  Table, TableHeader, TableBody, TableColumn, TableRow, TableCell,
  Progress, Link, Tabs, Tab,
  Accordion, AccordionItem,
} from "@heroui/react";
import {
  ResponsiveContainer,
  LineChart as RLineChart, Line,
  BarChart as RBarChart, Bar,
  PieChart as RPieChart, Pie, Cell,
  AreaChart as RAreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Spec {
  component: string;
  props?: Record<string, any>;
  children?: (Spec | string)[];
}

interface FlatElementSpec {
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
}

interface FlatSpec {
  root: string;
  state?: Record<string, unknown>;
  elements: Record<string, FlatElementSpec>;
}

interface ResolveContext {
  state: Record<string, unknown>;
  item?: unknown;
  index?: number;
  aliases?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Parser                                                             */
/* ------------------------------------------------------------------ */

function tryParse(json: string): unknown | null {
  try {
    const s = json.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim();
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isLegacySpec(value: unknown): value is Spec {
  const record = asRecord(value);
  return record !== null && typeof record.component === "string";
}

function isFlatSpec(value: unknown): value is FlatSpec {
  const record = asRecord(value);
  return (
    record !== null &&
    typeof record.root === "string" &&
    asRecord(record.elements) !== null
  );
}

function getByPath(value: unknown, path: string): unknown {
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

function getItemValue(item: unknown, path: string): unknown {
  return getByPath(item, normalizeAliasPath(path));
}

function findAliasReference(record: Record<string, unknown>): { alias: string; path: string } | null {
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
      key === "$or"
    ) {
      continue;
    }

    if (value === true) return { alias: key, path: "" };
    if (typeof value === "string") return { alias: key, path: value };
  }

  return null;
}

function resolveReferenceValue(
  record: Record<string, unknown>,
  ctx: ResolveContext,
): unknown {
  if (typeof record.$state === "string") return getByPath(ctx.state, record.$state);
  if (typeof record.$bindState === "string") return getByPath(ctx.state, record.$bindState);
  if (typeof record.$item === "string") return getItemValue(ctx.item, record.$item);
  if (typeof record.$bindItem === "string") return getItemValue(ctx.item, record.$bindItem);
  if (record.$index === true) return ctx.index;
  const aliasRef = findAliasReference(record);
  if (aliasRef && ctx.aliases?.[aliasRef.alias] !== undefined) {
    return getByPath(ctx.aliases[aliasRef.alias], normalizeAliasPath(aliasRef.path));
  }
  return undefined;
}

function resolveValue(value: unknown, ctx: ResolveContext): unknown {
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, ctx));

  const record = asRecord(value);
  if (!record) return value;

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

function evaluateVisible(condition: unknown, ctx: ResolveContext): boolean {
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
  if ("eq" in record || "equals" in record) return refValue === resolveValue(record.eq ?? record.equals, ctx);
  if ("neq" in record || "notEquals" in record) return refValue !== resolveValue(record.neq ?? record.notEquals, ctx);
  if (record.not === true) return !Boolean(refValue);
  if (refValue !== undefined) return Boolean(refValue);

  return Boolean(resolveValue(condition, ctx));
}

function expandFlatSpec(spec: FlatSpec): Spec | null {
  return expandElement(spec.root, spec, { state: spec.state ?? {} }, new Set());
}

function expandElement(
  key: string,
  spec: FlatSpec,
  ctx: ResolveContext,
  ancestors: Set<string>,
): Spec | null {
  if (ancestors.has(key)) return null;

  const element = spec.elements[key];
  if (!element) return null;
  if (element.visible !== undefined && !evaluateVisible(element.visible, ctx)) {
    return null;
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(key);

  const children: Spec[] = [];
  const childKeys = element.children ?? [];

  const repeatSource =
    typeof element.repeat?.statePath === "string"
      ? getByPath(ctx.state, element.repeat.statePath)
      : resolveValue(element.repeat?.source ?? element.repeat?.over, ctx);

  if (Array.isArray(repeatSource)) {
    const aliasKey = element.repeat?.as
      ? element.repeat.as.startsWith("$") ? element.repeat.as : `$${element.repeat.as}`
      : undefined;
    const indexAlias = element.repeat?.indexAs
      ? element.repeat.indexAs.startsWith("$") ? element.repeat.indexAs : `$${element.repeat.indexAs}`
      : undefined;

    const items = repeatSource;
    if (Array.isArray(items)) {
      items.forEach((item, index) => {
        const repeatCtx: ResolveContext = {
          ...ctx,
          item,
          index,
          aliases: {
            ...(ctx.aliases ?? {}),
            ...(aliasKey ? { [aliasKey]: item } : {}),
            ...(indexAlias ? { [indexAlias]: index } : {}),
          },
        };
        childKeys.forEach((childKey) => {
          const child = expandElement(childKey, spec, repeatCtx, nextAncestors);
          if (child) children.push(child);
        });
      });
    }
  } else {
    childKeys.forEach((childKey) => {
      const child = expandElement(childKey, spec, ctx, nextAncestors);
      if (child) children.push(child);
    });
  }

  const resolvedProps = asRecord(resolveValue(element.props ?? {}, ctx)) ?? undefined;

  return {
    component: element.type,
    props: resolvedProps,
    children: children.length > 0 ? children : undefined,
  };
}

function buildRenderableSpec(json: string): Spec | null {
  const parsed = tryParse(json);
  if (!parsed) return null;
  if (isFlatSpec(parsed)) return expandFlatSpec(parsed);
  if (isLegacySpec(parsed)) return parsed;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Chart palette                                                      */
/* ------------------------------------------------------------------ */

const CHART_COLORS = [
  "#006FEE", // primary blue
  "#17C964", // success green
  "#F5A524", // warning amber
  "#F31260", // danger red
  "#7828C8", // secondary purple
  "#0E8AAA", // teal
];

/* ------------------------------------------------------------------ */
/*  Helper: resolve heading tag                                        */
/* ------------------------------------------------------------------ */

function headingClasses(level: number): string {
  switch (level) {
    case 1: return "text-2xl font-bold tracking-tight";
    case 2: return "text-xl font-bold tracking-tight";
    case 3: return "text-lg font-semibold";
    case 4: return "text-base font-semibold";
    case 5: return "text-sm font-semibold";
    default: return "text-lg font-bold";
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: map variant string to HeroUI color                         */
/* ------------------------------------------------------------------ */

function resolveButtonColor(variant?: string): "primary" | "secondary" | "danger" | "warning" | "success" | "default" {
  if (!variant) return "default";
  if (variant === "primary") return "primary";
  if (variant === "secondary") return "secondary";
  if (variant === "danger" || variant === "destructive") return "danger";
  if (variant === "warning") return "warning";
  if (variant === "success") return "success";
  return "default";
}

function resolveChipColor(color?: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" {
  if (!color) return "primary";
  const map: Record<string, "primary" | "secondary" | "success" | "warning" | "danger" | "default"> = {
    blue: "primary", primary: "primary",
    green: "success", success: "success",
    red: "danger", danger: "danger", error: "danger",
    yellow: "warning", warning: "warning", amber: "warning", orange: "warning",
    purple: "secondary", secondary: "secondary",
    gray: "default", grey: "default", default: "default",
  };
  return map[color] ?? "primary";
}

/* ------------------------------------------------------------------ */
/*  Mini chart renderers (uses recharts)                               */
/* ------------------------------------------------------------------ */

function MiniLineChart({ data, xKey, yKey }: { data: any[]; xKey?: string; yKey?: string }) {
  const xk = xKey || (data[0] ? Object.keys(data[0]).find(k => typeof data[0][k] === "string") || Object.keys(data[0])[0] : "x");
  const yk = yKey || (data[0] ? Object.keys(data[0]).find(k => typeof data[0][k] === "number") || Object.keys(data[0])[1] : "y");

  return (
    <ResponsiveContainer width="100%" height={140}>
      <RLineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--heroui-default-200))" />
        <XAxis dataKey={xk} tick={{ fontSize: 10 }} stroke="hsl(var(--heroui-default-400))" />
        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--heroui-default-400))" />
        <RTooltip
          contentStyle={{
            backgroundColor: "hsl(var(--heroui-content1))",
            border: "1px solid hsl(var(--heroui-default-200))",
            borderRadius: 8,
            fontSize: 11,
          }}
        />
        <Line type="monotone" dataKey={yk} stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS[0] }} />
      </RLineChart>
    </ResponsiveContainer>
  );
}

function MiniBarChart({ data, xKey, yKey }: { data: any[]; xKey?: string; yKey?: string }) {
  const xk = xKey || (data[0] ? Object.keys(data[0]).find(k => typeof data[0][k] === "string") || Object.keys(data[0])[0] : "x");
  const yk = yKey || (data[0] ? Object.keys(data[0]).find(k => typeof data[0][k] === "number") || Object.keys(data[0])[1] : "y");

  return (
    <ResponsiveContainer width="100%" height={140}>
      <RBarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--heroui-default-200))" />
        <XAxis dataKey={xk} tick={{ fontSize: 10 }} stroke="hsl(var(--heroui-default-400))" />
        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--heroui-default-400))" />
        <RTooltip
          contentStyle={{
            backgroundColor: "hsl(var(--heroui-content1))",
            border: "1px solid hsl(var(--heroui-default-200))",
            borderRadius: 8,
            fontSize: 11,
          }}
        />
        <Bar dataKey={yk} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
      </RBarChart>
    </ResponsiveContainer>
  );
}

function MiniAreaChart({ data, xKey, yKey }: { data: any[]; xKey?: string; yKey?: string }) {
  const xk = xKey || (data[0] ? Object.keys(data[0]).find(k => typeof data[0][k] === "string") || Object.keys(data[0])[0] : "x");
  const yk = yKey || (data[0] ? Object.keys(data[0]).find(k => typeof data[0][k] === "number") || Object.keys(data[0])[1] : "y");

  return (
    <ResponsiveContainer width="100%" height={140}>
      <RAreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--heroui-default-200))" />
        <XAxis dataKey={xk} tick={{ fontSize: 10 }} stroke="hsl(var(--heroui-default-400))" />
        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--heroui-default-400))" />
        <RTooltip
          contentStyle={{
            backgroundColor: "hsl(var(--heroui-content1))",
            border: "1px solid hsl(var(--heroui-default-200))",
            borderRadius: 8,
            fontSize: 11,
          }}
        />
        <Area type="monotone" dataKey={yk} stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.15} strokeWidth={2} />
      </RAreaChart>
    </ResponsiveContainer>
  );
}

function MiniPieChart({ data }: { data: any[] }) {
  // Try to figure out name/value keys
  const nameKey = data[0] ? Object.keys(data[0]).find(k => typeof data[0][k] === "string") || Object.keys(data[0])[0] : "name";
  const valueKey = data[0] ? Object.keys(data[0]).find(k => typeof data[0][k] === "number") || Object.keys(data[0])[1] : "value";

  return (
    <ResponsiveContainer width="100%" height={140}>
      <RPieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          outerRadius={50}
          innerRadius={25}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((_: any, i: number) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <RTooltip
          contentStyle={{
            backgroundColor: "hsl(var(--heroui-content1))",
            border: "1px solid hsl(var(--heroui-default-200))",
            borderRadius: 8,
            fontSize: 11,
          }}
        />
      </RPieChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  SVG fallback chart (when recharts data is missing/empty)           */
/* ------------------------------------------------------------------ */

function FallbackChart({ type, label }: { type: string; label?: string }) {
  if (type === "PieChart") {
    return (
      <div className="flex flex-col items-center justify-center py-4">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--heroui-default-200))" strokeWidth="20" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={CHART_COLORS[0]} strokeWidth="20"
            strokeDasharray="100 152" strokeDashoffset="0" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={CHART_COLORS[1]} strokeWidth="20"
            strokeDasharray="60 192" strokeDashoffset="-100" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={CHART_COLORS[2]} strokeWidth="20"
            strokeDasharray="40 212" strokeDashoffset="-160" />
        </svg>
        {label && <span className="text-xs text-default-400 mt-2">{label}</span>}
      </div>
    );
  }
  // Bar fallback
  const bars = [65, 45, 80, 55, 70, 90, 60];
  return (
    <div className="flex items-end justify-center gap-1.5 h-24 py-3 px-4">
      {bars.map((h, i) => (
        <div
          key={i}
          className="rounded-t-sm flex-1 max-w-6 transition-all"
          style={{
            height: `${h}%`,
            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
            opacity: 0.75,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status chip for table cells                                        */
/* ------------------------------------------------------------------ */

function maybeStatusChip(value: string) {
  const lower = value.toLowerCase();
  if (["completed", "active", "paid", "approved", "shipped", "success", "online"].includes(lower)) {
    return <Chip size="sm" color="success" variant="flat" classNames={{ base: "h-5", content: "text-[11px] px-1" }}>{value}</Chip>;
  }
  if (["pending", "processing", "in progress", "review", "awaiting"].includes(lower)) {
    return <Chip size="sm" color="warning" variant="flat" classNames={{ base: "h-5", content: "text-[11px] px-1" }}>{value}</Chip>;
  }
  if (["cancelled", "failed", "rejected", "error", "declined", "overdue", "offline"].includes(lower)) {
    return <Chip size="sm" color="danger" variant="flat" classNames={{ base: "h-5", content: "text-[11px] px-1" }}>{value}</Chip>;
  }
  return value;
}

/* ------------------------------------------------------------------ */
/*  RenderNode                                                         */
/* ------------------------------------------------------------------ */

function RenderNode({ spec }: { spec: Spec | string }) {
  if (typeof spec === "string") return <span>{spec}</span>;

  const { component: c, props: p = {}, children: ch = [] } = spec;
  const kids = ch.map((child, i) => <RenderNode key={i} spec={child} />);

  switch (c) {

    /* ---- Layout ---- */

    case "Container":
      return <div className="flex flex-col gap-4">{kids}</div>;

    case "Stack": {
      const isRow = p.direction === "row" || p.direction === "horizontal";
      return (
        <div className={`flex ${isRow ? "flex-row flex-wrap items-center" : "flex-col"} gap-3`}>
          {kids}
        </div>
      );
    }

    case "Grid": {
      const cols = p.cols || p.columns || p.templateColumns || 2;
      const numCols = typeof cols === "number" ? cols : 2;
      return (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))` }}
        >
          {kids}
        </div>
      );
    }

    case "Form":
      return (
        <div className="flex flex-col gap-3">
          {p.title && (
            <h2 className="text-xl font-bold tracking-tight mb-1">{p.title}</h2>
          )}
          {kids}
        </div>
      );

    case "FormField":
      return (
        <div className="mb-1">
          {p.label && (
            <label className="text-xs font-medium text-default-600 block mb-1.5">
              {p.label}
              {p.required && <span className="text-danger ml-0.5">*</span>}
            </label>
          )}
          {kids}
        </div>
      );

    /* ---- Card ---- */

    case "Card": {
      const hasHeader = p.title || p.value;
      const hasChange = !!p.change;
      const highlight = p.highlight || p.border;

      return (
        <Card
          shadow="sm"
          className={`mb-2 ${highlight ? "border-2 border-primary" : ""}`}
        >
          {hasHeader && (
            <CardHeader className="flex flex-col items-start gap-0 pb-0 px-4 pt-4">
              {p.title && (
                <span className="text-xs font-medium text-default-400 uppercase tracking-wide">
                  {p.title}
                </span>
              )}
              {p.value && (
                <span className="text-2xl font-bold tracking-tight mt-0.5">
                  {p.value}
                </span>
              )}
              {hasChange && (
                <Chip
                  size="sm"
                  color={String(p.change).startsWith("-") ? "danger" : "success"}
                  variant="flat"
                  classNames={{ base: "mt-1 h-5", content: "text-[11px] font-semibold px-1" }}
                >
                  {p.change}
                </Chip>
              )}
            </CardHeader>
          )}
          {kids.length > 0 && (
            <CardBody className={`${hasHeader ? "pt-2" : "pt-4"} px-4 pb-4`}>
              {kids}
            </CardBody>
          )}
        </Card>
      );
    }

    /* ---- Typography ---- */

    case "Heading": {
      const level = p.level || p.size === "xl" ? 1 : p.size === "lg" ? 2 : p.size === "md" ? 3 : p.level || 2;
      const Tag = `h${Math.min(Math.max(level, 1), 6)}` as keyof JSX.IntrinsicElements;
      return (
        <Tag className={`${headingClasses(level)} mb-2`}>
          {p.text || kids}
        </Tag>
      );
    }

    case "Text": {
      const bold = p.fontWeight === "bold" || p.fontSize === "2xl" || p.fontSize === "3xl";
      const large = p.fontSize === "2xl" || p.fontSize === "3xl" || p.fontSize === "xl";
      const muted = p.color === "gray.600" || p.color === "gray" || p.color === "muted";
      return (
        <p className={`
          ${large ? "text-lg" : "text-sm"}
          ${bold ? "font-bold" : ""}
          ${muted ? "text-default-400" : "text-default-600"}
          leading-relaxed
        `.trim()}>
          {p.content || p.text || kids}
        </p>
      );
    }

    /* ---- Inputs ---- */

    case "Input":
      return (
        <Input
          size="sm"
          variant="bordered"
          label={p.label}
          placeholder={p.placeholder}
          type={p.type || "text"}
          className="mb-1 max-w-full"
          isReadOnly
          classNames={{
            inputWrapper: "border-default-200 hover:border-default-400",
          }}
        />
      );

    case "TextArea":
    case "Textarea":
      return (
        <Textarea
          size="sm"
          variant="bordered"
          label={p.label}
          placeholder={p.placeholder}
          minRows={p.rows || 3}
          className="mb-1 max-w-full"
          isReadOnly
          classNames={{
            inputWrapper: "border-default-200 hover:border-default-400",
          }}
        />
      );

    case "Select":
    case "Dropdown":
      return (
        <Select
          size="sm"
          variant="bordered"
          label={p.label}
          placeholder={p.placeholder || "Select..."}
          className="mb-1 max-w-full"
          classNames={{
            trigger: "border-default-200 hover:border-default-400",
          }}
        >
          {(p.options || []).map((o: any, i: number) => (
            <SelectItem key={typeof o === "string" ? o : o.value ?? i}>
              {typeof o === "string" ? o : o.label || String(o)}
            </SelectItem>
          ))}
        </Select>
      );

    /* ---- Button ---- */

    case "Button": {
      const color = resolveButtonColor(p.variant || p.colorScheme || p.color);
      const isOutline = p.variant === "ghost" || p.variant === "outline" || p.variant === "bordered";
      const isLight = p.variant === "light" || p.variant === "link";
      const heroVariant = isOutline ? "bordered" : isLight ? "light" : "solid";
      return (
        <Button
          size="sm"
          color={color}
          variant={heroVariant}
          className={`mb-1 font-medium ${p.fullWidth || p.width === "100%" ? "w-full" : ""}`}
        >
          {p.label || p.text || kids}
        </Button>
      );
    }

    /* ---- Badge / Chip ---- */

    case "Badge":
    case "Tag":
    case "Chip":
      return (
        <Chip
          size="sm"
          color={resolveChipColor(p.color || p.colorScheme)}
          variant="flat"
          classNames={{ base: "mb-1", content: "font-medium text-[11px]" }}
        >
          {p.text || p.label || kids}
        </Chip>
      );

    /* ---- Divider ---- */

    case "Divider":
    case "Separator":
      return (
        <div className="relative my-3">
          <Divider />
          {p.text && (
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-content1 px-2 text-xs text-default-400">
              {p.text}
            </span>
          )}
        </div>
      );

    /* ---- Table ---- */

    case "Table": {
      const rawCols = Array.isArray(p.columns) ? p.columns : Array.isArray(p.headers) ? p.headers : [];
      const rawRows = Array.isArray(p.rows) ? p.rows : Array.isArray(p.data) ? p.data : [];
      const cols = rawCols.map((col: any, i: number) => {
        if (typeof col === "string") return { key: col, label: col };
        return {
          key: col?.key || col?.id || `col-${i}`,
          label: col?.title || col?.label || col?.key || `Column ${i + 1}`,
        };
      });

      const rows = rawRows.map((row: any) => {
        if (Array.isArray(row)) return row;
        if (row && typeof row === "object") {
          return cols.map((col) => row[col.key]);
        }
        return [row];
      });

      if (!cols.length && !rows.length) {
        return (
          <div className="text-xs text-default-400 p-3 border border-default-200 rounded-lg text-center">
            Empty table
          </div>
        );
      }
      return (
        <Table
          aria-label="data"
          isCompact
          isStriped
          removeWrapper
          className="mb-2"
          classNames={{
            th: "text-[11px] font-semibold uppercase tracking-wider text-default-500 bg-default-50",
            td: "text-xs py-2",
          }}
        >
          <TableHeader>
            {cols.map((col, i: number) => (
              <TableColumn key={col.key || i}>{col.label}</TableColumn>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row: any, ri: number) => {
              const cells = Array.isArray(row) ? row : [row];
              return (
                <TableRow key={ri}>
                  {cells.map((cell: any, ci: number) => (
                    <TableCell key={ci}>
                      {typeof cell === "string" ? maybeStatusChip(cell) : String(cell ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      );
    }

    /* ---- List ---- */

    case "List":
      return (
        <ul className="space-y-1.5 text-sm text-default-600 mb-2">
          {kids}
        </ul>
      );

    case "ListItem":
      return (
        <li className="flex items-start gap-2 py-0.5">
          <span className="text-default-300 mt-1 shrink-0">&#x2022;</span>
          <span>{p.text || kids}</span>
        </li>
      );

    /* ---- Checkbox / Switch / Radio ---- */

    case "Checkbox":
      return <Checkbox size="sm" className="mb-1">{p.label}</Checkbox>;

    case "Switch":
    case "Toggle":
      return <Switch size="sm" className="mb-1">{p.label}</Switch>;

    case "RadioGroup": {
      return (
        <div className="mb-2">
          {p.label && (
            <label className="text-xs font-medium text-default-500 block mb-1.5">{p.label}</label>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {(p.options || []).map((o: any, i: number) => (
              <Chip
                key={i}
                size="sm"
                variant={i === 0 ? "solid" : "bordered"}
                color={i === 0 ? "primary" : "default"}
                className="cursor-pointer"
              >
                {typeof o === "string" ? o : o.label || String(o)}
              </Chip>
            ))}
          </div>
        </div>
      );
    }

    /* ---- Avatar ---- */

    case "Avatar":
      return (
        <Avatar
          size="sm"
          name={p.name || p.alt || "?"}
          src={p.src}
          color="primary"
          isBordered
          className="mb-1"
        />
      );

    /* ---- Icon (placeholder) ---- */

    case "Icon": {
      const iconColor = p.color === "green" ? "text-success" : p.color === "red" ? "text-danger" : "text-default-400";
      const iconName = p.name?.toLowerCase() || "";
      // Render common icon names as simple unicode glyphs
      let glyph = "\u25CF"; // filled circle default
      if (iconName === "check" || iconName === "checkmark") glyph = "\u2713";
      else if (iconName === "x" || iconName === "close") glyph = "\u2715";
      else if (iconName === "star") glyph = "\u2605";
      else if (iconName === "heart") glyph = "\u2665";
      else if (iconName === "search") glyph = "\u26B2";
      else if (iconName === "google") glyph = "G";
      else if (iconName === "arrow-right") glyph = "\u2192";
      else if (iconName === "arrow-left") glyph = "\u2190";
      else if (iconName === "mail" || iconName === "email") glyph = "\u2709";
      else if (iconName === "phone") glyph = "\u260E";
      else if (iconName === "settings" || iconName === "gear") glyph = "\u2699";
      return (
        <span className={`inline-flex items-center justify-center w-4 h-4 text-xs ${iconColor}`}>
          {glyph}
        </span>
      );
    }

    /* ---- Link ---- */

    case "Link":
      return (
        <Link size="sm" className="text-primary text-sm cursor-pointer mb-1">
          {p.text || p.label || kids}
        </Link>
      );

    /* ---- Progress ---- */

    case "Progress":
      return (
        <div className="mb-2">
          {p.label && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium text-default-600">{p.label}</span>
              {p.value != null && <span className="text-xs text-default-400">{p.value}%</span>}
            </div>
          )}
          <Progress
            size="sm"
            value={p.value ?? 50}
            color={
              (p.value ?? 50) >= 80 ? "success" :
              (p.value ?? 50) >= 50 ? "primary" :
              (p.value ?? 50) >= 25 ? "warning" : "danger"
            }
            className="max-w-full"
          />
        </div>
      );

    /* ---- Image ---- */

    case "Image":
    case "ImageGallery":
      return (
        <div className="flex items-center justify-center rounded-xl bg-gradient-to-br from-default-100 to-default-50 border border-default-200 mb-2 overflow-hidden"
          style={{ height: p.height || 64, minHeight: 48 }}
        >
          {p.src ? (
            <img
              src={p.src}
              alt={p.alt || "Image"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" className="text-default-300" strokeWidth="1.5"/>
                <circle cx="7" cy="8" r="1.5" fill="currentColor" className="text-default-300"/>
                <path d="M2 14l4-4 3 3 4-5 5 6" stroke="currentColor" className="text-default-300" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <span className="text-[10px] text-default-400">{p.alt || "Image"}</span>
            </div>
          )}
        </div>
      );

    /* ---- Charts ---- */

    case "LineChart": {
      const data = p.data || [];
      if (!data.length) return <FallbackChart type="LineChart" label={p.title} />;
      return (
        <div className="mb-2">
          <MiniLineChart data={data} xKey={p.xDataKey || p.xKey} yKey={p.yDataKey || p.yKey} />
        </div>
      );
    }

    case "BarChart": {
      const data = p.data || [];
      if (!data.length) return <FallbackChart type="BarChart" label={p.title} />;
      return (
        <div className="mb-2">
          <MiniBarChart data={data} xKey={p.xDataKey || p.xKey} yKey={p.yDataKey || p.yKey} />
        </div>
      );
    }

    case "AreaChart": {
      const data = p.data || [];
      if (!data.length) return <FallbackChart type="AreaChart" label={p.title} />;
      return (
        <div className="mb-2">
          <MiniAreaChart data={data} xKey={p.xDataKey || p.xKey} yKey={p.yDataKey || p.yKey} />
        </div>
      );
    }

    case "PieChart": {
      const data = p.data || [];
      if (!data.length) return <FallbackChart type="PieChart" label={p.title} />;
      return (
        <div className="mb-2">
          <MiniPieChart data={data} />
        </div>
      );
    }

    case "ScatterChart": {
      // Render as a bar chart fallback since scatter is uncommon
      const data = p.data || [];
      if (!data.length) return <FallbackChart type="BarChart" label={p.title} />;
      return (
        <div className="mb-2">
          <MiniBarChart data={data} xKey={p.xDataKey || p.xKey} yKey={p.yDataKey || p.yKey} />
        </div>
      );
    }

    /* ---- Tabs ---- */

    case "Tabs": {
      // Build tabs from TabPanel children
      const tabChildren = ch.filter(
        (child): child is Spec => typeof child !== "string" && (child.component === "TabPanel" || child.component === "Tab")
      );
      if (tabChildren.length === 0) {
        return <div className="mb-2">{kids}</div>;
      }
      return (
        <Tabs
          aria-label="tabs"
          size="sm"
          variant="underlined"
          classNames={{ tabList: "gap-2", tab: "text-xs" }}
          className="mb-2"
        >
          {tabChildren.map((tab, i) => (
            <Tab key={i} title={tab.props?.label || tab.props?.title || `Tab ${i + 1}`}>
              <div className="py-2">
                {(tab.children || []).map((child, j) => (
                  <RenderNode key={j} spec={child} />
                ))}
              </div>
            </Tab>
          ))}
        </Tabs>
      );
    }

    case "TabPanel": {
      // Standalone tab panel (not inside Tabs) -- render as a labeled section
      return (
        <div className="mb-2">
          {p.label && (
            <Chip size="sm" variant="flat" color="primary" className="mb-2">{p.label}</Chip>
          )}
          {kids}
        </div>
      );
    }

    /* ---- CodeBlock ---- */

    case "CodeBlock":
      return (
        <pre className="p-3 rounded-lg bg-default-50 border border-default-200 text-xs font-mono overflow-auto mb-2 leading-relaxed text-default-700">
          <code>{p.code || p.content || kids}</code>
        </pre>
      );

    /* ---- Accordion ---- */

    case "Accordion": {
      const accordionItems = ch.filter(
        (child): child is Spec => typeof child !== "string" && child.component === "AccordionItem"
      );
      if (accordionItems.length === 0) {
        return <div className="mb-2">{kids}</div>;
      }
      return (
        <Accordion variant="bordered" className="mb-2" selectionMode="multiple">
          {accordionItems.map((item, i) => (
            <AccordionItem
              key={i}
              aria-label={item.props?.title || `Section ${i + 1}`}
              title={
                <span className="text-sm font-medium">
                  {item.props?.title || `Section ${i + 1}`}
                </span>
              }
            >
              {(item.children || []).map((child, j) => (
                <RenderNode key={j} spec={child} />
              ))}
            </AccordionItem>
          ))}
        </Accordion>
      );
    }

    case "AccordionItem": {
      // Standalone accordion item (not inside Accordion parent) -- render as a collapsible section
      return (
        <Accordion variant="bordered" className="mb-2">
          <AccordionItem
            key="0"
            aria-label={p.title || "Section"}
            title={<span className="text-sm font-medium">{p.title || "Section"}</span>}
          >
            {kids}
          </AccordionItem>
        </Accordion>
      );
    }

    /* ---- Nav / Sidebar ---- */

    case "Sidebar":
    case "Nav":
      return (
        <nav className="flex gap-1 flex-wrap mb-2">
          {kids}
        </nav>
      );

    case "NavItem":
      return (
        <Chip
          size="sm"
          variant={p.active ? "solid" : "light"}
          color={p.active ? "primary" : "default"}
          className="cursor-pointer"
        >
          {p.label || p.text || kids}
        </Chip>
      );

    /* ---- Alert / Callout ---- */

    case "Alert":
    case "Callout": {
      const alertColor = p.type === "error" || p.type === "danger" ? "danger"
        : p.type === "warning" ? "warning"
        : p.type === "success" ? "success"
        : "warning";
      return (
        <Card
          className={`mb-2 border-l-4 ${
            alertColor === "danger" ? "border-l-danger" :
            alertColor === "success" ? "border-l-success" :
            "border-l-warning"
          }`}
          shadow="none"
        >
          <CardBody className="py-2 px-3 text-sm text-default-600">
            {p.title && <span className="font-semibold block mb-0.5">{p.title}</span>}
            {p.message || p.text || kids}
          </CardBody>
        </Card>
      );
    }

    /* ---- Stepper / Steps ---- */

    case "Stepper":
    case "Steps": {
      return (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {ch.map((child, i) => {
            const label = typeof child === "string" ? child : child.props?.label || child.props?.title || `Step ${i + 1}`;
            const active = typeof child !== "string" && child.props?.active;
            const completed = typeof child !== "string" && child.props?.completed;
            return (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <div className="w-6 h-px bg-default-200" />}
                <div className={`flex items-center gap-1.5 text-xs ${active ? "text-primary font-semibold" : completed ? "text-success" : "text-default-400"}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    active ? "bg-primary text-white" : completed ? "bg-success text-white" : "bg-default-100 text-default-400"
                  }`}>
                    {completed ? "\u2713" : i + 1}
                  </div>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    case "StepperStep": {
      return (
        <div className="flex items-center gap-1.5 text-xs text-default-500">
          <div className="w-5 h-5 rounded-full bg-default-100 flex items-center justify-center text-[10px] font-bold">
            {p.step || "?"}
          </div>
          {p.label || p.title || kids}
        </div>
      );
    }

    /* ---- Catch-all ---- */

    default:
      return kids.length ? <div className="flex flex-col gap-2">{kids}</div> : null;
  }
}

/* ------------------------------------------------------------------ */
/*  Public component                                                   */
/* ------------------------------------------------------------------ */

export function SpecRenderer({ json }: { json: string }) {
  const spec = useMemo(() => buildRenderableSpec(json), [json]);

  if (!spec) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-default-400">
        Could not parse JSON spec
      </div>
    );
  }

  return (
    <div className="p-1">
      <RenderNode spec={spec} />
    </div>
  );
}
