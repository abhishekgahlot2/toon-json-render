import { Card, CardBody, CardHeader, Button, Link } from "@heroui/react";

const links = [
  {
    title: "json-render Examples",
    desc: "Browse the upstream example gallery and compare it with the curated demos on this landing page.",
    href: "https://json-render.dev/examples",
    cta: "Open gallery",
  },
  {
    title: "Docs Overview",
    desc: "See the flat spec, bindings, visibility, actions, and renderer surfaces in the official docs.",
    href: "https://json-render.dev/docs",
    cta: "Read docs",
  },
  {
    title: "Core API",
    desc: "Reference for nestedToFlat, streaming helpers, SpecStream utilities, and core normalization APIs.",
    href: "https://json-render.dev/docs/api/core",
    cta: "View API",
  },
];

export default function LiveExamples() {
  return (
    <section id="examples-upstream" className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-1 text-center text-2xl font-bold">Live Examples</h2>
        <p className="mb-8 text-center text-sm text-default-400">
          This site ships a curated TOON demo set. For the broader upstream gallery and live example surface, use the official json-render examples and docs.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {links.map((item) => (
            <Card key={item.title} className="border border-white/5">
              <CardHeader className="px-5 pb-0 pt-5">
                <h3 className="text-base font-semibold">{item.title}</h3>
              </CardHeader>
              <CardBody className="px-5 pb-5 pt-3">
                <p className="mb-4 text-sm text-default-400">{item.desc}</p>
                <Button as="a" href={item.href} size="sm" variant="bordered" className="w-full" target="_blank" rel="noreferrer">
                  {item.cta}
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-default-400">
          Want full parity across `json`, `nested`, `stream`, and `catalog`? Track support above and compare against the official <Link href="https://json-render.dev/examples" isExternal size="sm">example gallery</Link>.
        </p>
      </div>
    </section>
  );
}
