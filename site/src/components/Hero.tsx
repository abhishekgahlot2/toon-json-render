import { useEffect, useState } from "react";
import { Button, Input, Chip } from "@heroui/react";

const suggestionPrompts = [
  "Create a login form with email and password",
  "Build a pricing page with three tiers",
  "Create a dashboard with stats and a chart",
];

export default function Hero({
  currentPrompt,
  onTryPrompt,
}: {
  currentPrompt: string;
  onTryPrompt: (prompt: string) => void;
}) {
  const [prompt, setPrompt] = useState(currentPrompt);

  useEffect(() => {
    setPrompt(currentPrompt);
  }, [currentPrompt]);

  const submit = () => {
    if (!prompt.trim()) return;
    onTryPrompt(prompt.trim());
    if (typeof window !== "undefined") {
      document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="px-4 pt-28 pb-16 text-center">
      <p className="text-xs uppercase tracking-widest text-default-400 mb-4">
        TOON adapter for json-render
      </p>
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
        AI <span className="text-default-400 font-light">&rarr;</span>{" "}
        <span className="text-foreground">TOON</span>{" "}
        <span className="text-default-400 font-light">&rarr;</span> UI
      </h1>
      <p className="text-default-400 mb-8 max-w-md mx-auto">
        Same json-render flat spec. Fewer tokens. No new language.
      </p>
      <div className="mx-auto mb-4 flex max-w-4xl gap-2">
        <Input
          size="lg"
          value={prompt}
          onValueChange={setPrompt}
          placeholder="Try a prompt with local curated demos"
          classNames={{
            input: "font-mono text-sm",
            inputWrapper: "border-default-200",
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
        <Button color="default" size="lg" onPress={submit}>
          Try
        </Button>
      </div>
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {suggestionPrompts.map((item) => (
          <Chip key={item} variant="bordered" className="cursor-pointer" onClick={() => onTryPrompt(item)}>
            {item}
          </Chip>
        ))}
      </div>
      <p className="mx-auto mb-8 max-w-xl text-xs text-default-400">
        Instant local demo matching. No API key required for the curated prompts below.
      </p>
      <div className="flex gap-3 justify-center mb-14">
        <Button color="default" variant="solid" size="md" as="a" href="#demo">
          See demos
        </Button>
        <Button variant="bordered" size="md" as="a" href="https://github.com/abhishekgahlot2/toon-json-render">
          GitHub
        </Button>
      </div>
      <div className="flex justify-center gap-10 text-center">
        <div><div className="text-xl font-semibold tabular-nums">23%</div><div className="text-xs text-default-400">fewer tokens</div></div>
        <div><div className="text-xl font-semibold tabular-nums">24</div><div className="text-xs text-default-400">demos</div></div>
        <div><div className="text-xl font-semibold tabular-nums">7/7</div><div className="text-xs text-default-400">TOON validity</div></div>
        <div><div className="text-xl font-semibold tabular-nums">6.6%</div><div className="text-xs text-default-400">off OpenUI</div></div>
      </div>
    </section>
  );
}
