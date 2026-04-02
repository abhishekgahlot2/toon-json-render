import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { name: "table", JSON: 282, TOON: 132, OpenUI: 120 },
  { name: "chart", JSON: 194, TOON: 147, OpenUI: 102 },
  { name: "form", JSON: 607, TOON: 354, OpenUI: 225 },
  { name: "dashboard", JSON: 635, TOON: 801, OpenUI: 505 },
  { name: "pricing", JSON: 1174, TOON: 871, OpenUI: 1232 },
  { name: "settings", JSON: 1533, TOON: 1256, OpenUI: 1025 },
  { name: "e-commerce", JSON: 987, TOON: 612, OpenUI: 706 },
];

const COLORS = {
  JSON: "#ef4444",
  TOON: "#22c55e",
  OpenUI: "#3b82f6",
} as const;

const stats = [
  { value: "23%", label: "fewer tokens vs JSON", color: "success" as const, icon: "↓" },
  { value: "7/7", label: "TOON validity", color: "primary" as const, icon: "✓" },
  { value: "6.6%", label: "off OpenUI", color: "success" as const, icon: "≈" },
  { value: "24", label: "demo scenarios", color: "warning" as const, icon: "#" },
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-zinc-300">{entry.dataKey}</span>
            </div>
            <span className="text-sm font-semibold tabular-nums text-zinc-100">
              {entry.value.toLocaleString()} tokens
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Benchmarks() {
  const totalJ = data.reduce((s, d) => s + d.JSON, 0);
  const totalT = data.reduce((s, d) => s + d.TOON, 0);
  const totalO = data.reduce((s, d) => s + d.OpenUI, 0);

  return (
    <section id="bench" className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-1 text-center text-2xl font-bold">Benchmarks</h2>
        <p className="mb-8 text-center text-sm text-default-400">
          Claude Sonnet 4 across 7 canonical json-render scenarios. Same flat spec, valid output, and now within 6.6% of OpenUI on output tokens.
        </p>

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="border border-white/5">
              <CardBody className="py-5 text-center">
                <div className="mb-1 text-xs text-default-400">{s.icon}</div>
                <div
                  className={`text-3xl font-bold tracking-tight ${
                    s.color === "success"
                      ? "text-success"
                      : s.color === "warning"
                        ? "text-warning"
                        : "text-primary"
                  }`}
                >
                  {s.value}
                </div>
                <div className="mt-1 text-xs text-default-400">{s.label}</div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Bar Chart */}
        <Card className="mb-6 border border-white/5">
          <CardHeader className="flex-col items-start gap-1 px-6 pb-0 pt-5">
            <div className="flex w-full items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Output tokens by scenario</h3>
                <p className="text-xs text-default-400">
                  Current benchmark run comparing JSON, TOON, and OpenUI
                </p>
              </div>
              <div className="flex gap-2">
                <Chip size="sm" variant="flat" className="bg-red-500/10 text-red-400">
                  JSON
                </Chip>
                <Chip size="sm" variant="flat" className="bg-green-500/10 text-green-400">
                  TOON
                </Chip>
                <Chip size="sm" variant="flat" className="bg-blue-500/10 text-blue-400">
                  OpenUI
                </Chip>
              </div>
            </div>
          </CardHeader>
          <CardBody className="px-2 pb-4 pt-4">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={data}
                margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#71717a", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#52525b", fontSize: 11 }}
                  tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
                  dx={-5}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{
                    stroke: "rgba(255,255,255,0.1)",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                />
                <Bar
                  dataKey="JSON"
                  fill={COLORS.JSON}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="TOON"
                  fill={COLORS.TOON}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="OpenUI"
                  fill={COLORS.OpenUI}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Comparison Table */}
        <Card className="border border-white/5">
          <CardHeader className="px-6 pb-0 pt-5">
            <h3 className="text-base font-semibold">Detailed comparison</h3>
          </CardHeader>
          <CardBody className="overflow-auto px-6 pb-5 pt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3 text-left text-xs font-medium uppercase tracking-wider text-default-400">
                    Scenario
                  </th>
                  <th className="py-3 text-right text-xs font-medium uppercase tracking-wider text-red-400/70">
                    JSON
                  </th>
                  <th className="py-3 text-right text-xs font-medium uppercase tracking-wider text-green-400/70">
                    TOON
                  </th>
                  <th className="py-3 text-right text-xs font-medium uppercase tracking-wider text-blue-400/70">
                    OpenUI
                  </th>
                  <th className="py-3 text-right text-xs font-medium uppercase tracking-wider text-default-400">
                    Savings
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => {
                  const sv = ((1 - d.TOON / d.JSON) * 100).toFixed(0);
                  const best = Math.min(d.JSON, d.TOON, d.OpenUI);
                  return (
                    <tr
                      key={d.name}
                      className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="py-3 font-medium capitalize">{d.name}</td>
                      <td
                        className={`py-3 text-right tabular-nums ${
                          d.JSON === best
                            ? "font-semibold text-success"
                            : "text-default-400"
                        }`}
                      >
                        {d.JSON.toLocaleString()}
                      </td>
                      <td
                        className={`py-3 text-right tabular-nums ${
                          d.TOON === best
                            ? "font-semibold text-success"
                            : "text-default-400"
                        }`}
                      >
                        {d.TOON.toLocaleString()}
                      </td>
                      <td
                        className={`py-3 text-right tabular-nums ${
                          d.OpenUI === best
                            ? "font-semibold text-success"
                            : "text-default-400"
                        }`}
                      >
                        {d.OpenUI.toLocaleString()}
                      </td>
                      <td className="py-3 text-right">
                        <Chip
                          size="sm"
                          variant="flat"
                          className="bg-success/10 text-success"
                        >
                          {sv}%
                        </Chip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-white/10 font-bold">
                  <td className="py-3">Total</td>
                  <td className="py-3 text-right tabular-nums text-default-400">
                    {totalJ.toLocaleString()}
                  </td>
                  <td className="py-3 text-right tabular-nums text-success">
                    {totalT.toLocaleString()}
                  </td>
                  <td className="py-3 text-right tabular-nums text-default-400">
                    {totalO.toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    <Chip
                      size="sm"
                      variant="flat"
                      className="bg-success/10 font-bold text-success"
                    >
                      {((1 - totalT / totalJ) * 100).toFixed(0)}%
                    </Chip>
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
