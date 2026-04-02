import { useMemo, useState } from "react";
import Hero from "./components/Hero";
import DemoSection from "./components/DemoSection";
import Benchmarks from "./components/Benchmarks";
import HowItWorks from "./components/HowItWorks";
import CapabilityMatrix from "./components/CapabilityMatrix";
import LiveExamples from "./components/LiveExamples";
import Footer from "./components/Footer";
import { demos } from "./data/demos";

const demoKeys = Object.keys(demos);

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function scorePrompt(query: string, corpus: string) {
  const queryTokens = tokenize(query);
  const corpusTokens = new Set(tokenize(corpus));
  let score = 0;

  for (const token of queryTokens) {
    if (corpusTokens.has(token)) score += 1;
  }

  return score;
}

export default function App() {
  const [activeDemoKey, setActiveDemoKey] = useState("login");

  const currentPrompt = useMemo(() => demos[activeDemoKey]?.prompt ?? "", [activeDemoKey]);

  const handlePromptSelect = (prompt: string) => {
    let bestKey = demoKeys[0];
    let bestScore = -1;

    for (const key of demoKeys) {
      const demo = demos[key];
      const score = scorePrompt(prompt, `${demo.label} ${demo.prompt}`);
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }

    setActiveDemoKey(bestKey);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Hero currentPrompt={currentPrompt} onTryPrompt={handlePromptSelect} />
      <DemoSection activeKey={activeDemoKey} onActiveKeyChange={setActiveDemoKey} />
      <Benchmarks />
      <CapabilityMatrix />
      <HowItWorks />
      <LiveExamples />
      <Footer />
    </div>
  );
}
