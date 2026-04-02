import { Card, CardBody, Chip } from "@heroui/react";

const steps = [
  { n: "1", title: "Strict decode", desc: "Works most of the time. Standard TOON parse." },
  { n: "2", title: "Repair [N] headers", desc: "Fixes array length mismatches from LLMs." },
  { n: "3", title: "Repair + lenient", desc: "Tolerates minor structural issues." },
  { n: "4", title: "JSON fallback", desc: "If everything else fails, parse as plain JSON." },
];

const pipeline = ["Catalog", "TOON Prompt", "LLM", "TOON Stream", "Recovery Decoder", "UI"];
const highlighted = new Set(["TOON Prompt", "TOON Stream", "Recovery Decoder"]);

export default function HowItWorks() {
  return (
    <section id="how" className="px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-1 text-2xl font-bold text-center">How it works</h2>
        <p className="mb-8 text-sm text-center text-default-400">
          Your catalog goes into the prompt. The LLM outputs TOON. The decoder handles errors.
        </p>

        <div className="flex items-center justify-center gap-2 flex-wrap mb-10">
          {pipeline.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <Chip
                variant={highlighted.has(step) ? "flat" : "bordered"}
                color={highlighted.has(step) ? "success" : "default"}
                size="sm"
              >
                {step}
              </Chip>
              {i < pipeline.length - 1 && <span className="text-default-400">→</span>}
            </span>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {steps.map((s) => (
            <Card key={s.n}>
              <CardBody className="flex flex-row gap-3 items-start">
                <Chip size="sm" color="success" variant="flat" className="mt-0.5">
                  {s.n}
                </Chip>
                <div>
                  <div className="text-sm font-semibold">{s.title}</div>
                  <div className="text-xs text-default-400">{s.desc}</div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
