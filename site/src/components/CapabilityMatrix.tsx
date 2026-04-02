import { Card, CardBody, CardHeader, Chip, Link } from "@heroui/react";

const rows = [
  {
    surface: "json",
    support: "Full",
    detail: "Primary target. Flat root / state / elements flow is the main adapter lane.",
    href: "https://json-render.dev/docs",
  },
  {
    surface: "nested",
    support: "Partial",
    detail: "Tree-like inputs can be normalized, but the repo is not positioned as a first-class nested authoring surface.",
    href: "https://json-render.dev/docs/api/core",
  },
  {
    surface: "stream",
    support: "Partial",
    detail: "Supports TOON streaming and incremental decode. This is not full upstream SpecStream JSONL parity.",
    href: "https://json-render.dev/docs/api/core",
  },
  {
    surface: "catalog",
    support: "Partial",
    detail: "Catalog-aware prompt generation is supported. Full upstream schema/catalog APIs are not all mirrored yet.",
    href: "https://json-render.dev/docs",
  },
];

function supportColor(support: string) {
  if (support === "Full") return "success" as const;
  if (support === "Partial") return "warning" as const;
  return "default" as const;
}

export default function CapabilityMatrix() {
  return (
    <section id="capability" className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-1 text-center text-2xl font-bold">Upstream Surfaces</h2>
        <p className="mb-8 text-center text-sm text-default-400">
          Current support across the main json-render surfaces. The adapter is strongest on the flat JSON spec.
        </p>

        <Card className="border border-white/5">
          <CardHeader className="px-6 pb-0 pt-5">
            <h3 className="text-base font-semibold">Capability Matrix</h3>
          </CardHeader>
          <CardBody className="overflow-auto px-6 pb-5 pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3 text-left text-xs font-medium uppercase tracking-wider text-default-400">Surface</th>
                  <th className="py-3 text-left text-xs font-medium uppercase tracking-wider text-default-400">Support</th>
                  <th className="py-3 text-left text-xs font-medium uppercase tracking-wider text-default-400">Notes</th>
                  <th className="py-3 text-left text-xs font-medium uppercase tracking-wider text-default-400">Upstream</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.surface} className="border-b border-white/5 align-top last:border-b-0">
                    <td className="py-4 font-medium">{row.surface}</td>
                    <td className="py-4">
                      <Chip size="sm" variant="flat" color={supportColor(row.support)}>
                        {row.support}
                      </Chip>
                    </td>
                    <td className="py-4 text-default-400">{row.detail}</td>
                    <td className="py-4">
                      <Link size="sm" href={row.href} isExternal>
                        View docs
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
