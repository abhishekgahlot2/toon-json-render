import { useState, useMemo, useCallback } from "react";
import { Card, CardBody, Tabs, Tab, ScrollShadow, Input, Button, Chip } from "@heroui/react";
import { demos } from "../data/demos";
import { SpecRenderer } from "./SpecRenderer";

const demoKeys = Object.keys(demos);
const CATALOG = "Stack,Card,Button,Input,TextArea,Select,Table,Tabs,TabPanel,Text,Heading,Image,Badge,Divider,BarChart,LineChart,Grid,Container,Form,List,ListItem";
const localPromptKeys = ["login", "dashboard", "pricing", "charts"] as const;

export default function DemoSection({
  activeKey,
  onActiveKeyChange,
}: {
  activeKey: string;
  onActiveKeyChange: (key: string) => void;
}) {
  const [codeTab, setCodeTab] = useState<"json" | "toon">("toon");
  const [apiKey, setApiKey] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customJson, setCustomJson] = useState<string | null>(null);
  const [customToon, setCustomToon] = useState<string | null>(null);
  const [customJTok, setCustomJTok] = useState(0);
  const [customTTok, setCustomTTok] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  async function generate() {
    if (!apiKey || !customPrompt) return;
    setLoading(true);
    setShowCustom(true);
    const jSys = `You generate UIs as JSON in json-render flat-spec format. Components: ${CATALOG}
Format:
{
  "root": "main",
  "state": { "form": { "query": "" } },
  "elements": {
    "main": { "type": "Stack", "children": ["input1", "btn1"] },
    "input1": { "type": "Input", "props": { "label": "Search", "value": { "$bindState": "/form/query" } } },
    "btn1": { "type": "Button", "props": { "label": "Go" } }
  }
}
Rules: use top-level root/state/elements, use type not component, and use child key references. Output ONLY valid JSON.`;
    const tSys = `You generate UIs in TOON encoding of the json-render flat spec. Components: ${CATALOG}
Example:
root: main
state:
  form:
    query:
elements:
  main:
    type: Stack
    children: [2]: input1\tbtn1
  input1:
    type: Input
    props:
      label: Search
      value:
        $bindState: /form/query
  btn1:
    type: Button
    props:
      label: Go
Rules: use top-level root/state/elements, type not component, child key references, correct [N] counts, short stable element ids, and omit obvious defaults. Prefer tabular arrays for arrays of objects. Output ONLY valid TOON.`;
    try {
      const [jR, tR] = await Promise.all([
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "HTTP-Referer": location.href },
          body: JSON.stringify({ model: "qwen/qwen3.6-plus-preview:free", messages: [{ role: "system", content: jSys }, { role: "user", content: customPrompt }], max_tokens: 4096 }),
        }).then(r => r.json()),
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "HTTP-Referer": location.href },
          body: JSON.stringify({ model: "qwen/qwen3.6-plus-preview:free", messages: [{ role: "system", content: tSys }, { role: "user", content: customPrompt }], max_tokens: 4096 }),
        }).then(r => r.json()),
      ]);
      setCustomJson(jR.choices?.[0]?.message?.content || JSON.stringify(jR.error));
      setCustomToon(tR.choices?.[0]?.message?.content || JSON.stringify(tR.error));
      setCustomJTok(jR.usage?.completion_tokens || 0);
      setCustomTTok(tR.usage?.completion_tokens || 0);
    } catch (e: any) {
      setCustomJson(`Error: ${e.message}`);
      setCustomToon(`Error: ${e.message}`);
    }
    setLoading(false);
  }

  const d = demos[activeKey];
  const savings = useMemo(
    () => (d.jsonTokens > 0 ? Math.round((1 - d.toonTokens / d.jsonTokens) * 100) : 0),
    [d],
  );

  const handleDemoChange = useCallback((k: React.Key) => onActiveKeyChange(k as string), [onActiveKeyChange]);

  return (
    <section id="demo" className="px-4 py-16">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-2xl font-bold text-center mb-1">Examples</h2>
        <p className="text-sm text-center text-default-400 mb-6">
          {demoKeys.length} UI components. Click any to compare.
        </p>

        <div className="mb-6 rounded-xl border border-default-200 px-4 py-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-default-400">
            Local Prompt Demo
          </div>
          <p className="mb-3 text-sm text-default-400">
            Instant prompt-to-demo matching with curated examples. No API key required.
          </p>
          <div className="mb-3 rounded-lg border border-default-200 bg-default-50 px-3 py-3">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-default-400">
              Selected Prompt
            </div>
            <p className="text-sm text-default-600">{demos[activeKey].prompt}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {localPromptKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onActiveKeyChange(key)}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  activeKey === key
                    ? "border-primary bg-primary/10"
                    : "border-default-200 bg-content1 hover:bg-default-50"
                }`}
              >
                <div
                  className={`text-sm font-medium ${
                    activeKey === key ? "text-primary" : "text-default-700"
                  }`}
                >
                  {demos[key].label}
                </div>
                <div className="mt-1 line-clamp-3 text-xs text-default-400">
                  {demos[key].prompt}
                </div>
              </button>
            ))}
          </div>
        </div>

        <ScrollShadow orientation="horizontal" className="mb-4">
          <Tabs
            aria-label="Demos"
            selectedKey={activeKey}
            onSelectionChange={handleDemoChange}
            variant="underlined"
            size="sm"
            classNames={{ tabList: "gap-2 flex-nowrap", tab: "whitespace-nowrap text-xs" }}
          >
            {demoKeys.map((k) => (
              <Tab key={k} title={demos[k].label} />
            ))}
          </Tabs>
        </ScrollShadow>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* Code panel */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-default-200">
              <Tabs
                size="sm"
                variant="light"
                selectedKey={codeTab}
                onSelectionChange={(k) => setCodeTab(k as "json" | "toon")}
                classNames={{ tabList: "gap-2 p-0", tab: "px-2 h-6 text-xs" }}
              >
                <Tab key="json" title={<span className="text-default-500">json <span className="text-default-400 font-mono">{d.jsonTokens}</span></span>} />
                <Tab key="toon" title={<span className="text-default-500">toon <span className="text-default-400 font-mono">{d.toonTokens}</span></span>} />
              </Tabs>
              <span className="text-xs text-default-400 font-mono">{savings}% smaller</span>
            </div>
            <CardBody className="p-0">
              <ScrollShadow className="h-[460px]">
                <pre className="px-4 py-3 text-xs leading-relaxed font-mono whitespace-pre-wrap break-words text-default-500">
                  {codeTab === "toon" ? d.toon : d.json}
                </pre>
              </ScrollShadow>
            </CardBody>
          </Card>

          {/* Live render */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-default-200">
              <span className="text-xs text-default-500">Preview</span>
              <span className="text-xs text-default-400">from JSON spec</span>
            </div>
            <CardBody className="p-0">
              <ScrollShadow className="h-[460px]">
                <div className="p-4">
                  <SpecRenderer json={d.json} />
                </div>
              </ScrollShadow>
            </CardBody>
          </Card>
        </div>
        {/* BYOK: generate with your own key */}
        <div className="mt-6 p-4 border border-default-200 rounded-lg">
          <p className="text-xs text-default-400 mb-3">Generate with your own prompt (free OpenRouter models)</p>
          <div className="flex gap-2 flex-wrap">
            <Input
              size="sm"
              type="password"
              placeholder="OpenRouter API key"
              value={apiKey}
              onValueChange={setApiKey}
              className="w-48"
              classNames={{ input: "text-xs font-mono" }}
            />
            <Input
              size="sm"
              placeholder="Describe a UI..."
              value={customPrompt}
              onValueChange={setCustomPrompt}
              className="flex-1 min-w-[200px]"
              classNames={{ input: "text-xs" }}
              onKeyDown={(e) => e.key === "Enter" && generate()}
            />
            <Button size="sm" color="default" isLoading={loading} onPress={generate}>
              Generate
            </Button>
          </div>
        </div>

        {/* Custom generation results */}
        {showCustom && customJson && (
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr] mt-4">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-default-200">
                <span className="text-xs text-default-500">json {customJTok > 0 && <span className="font-mono text-default-400">{customJTok}</span>}</span>
                {customJTok > 0 && customTTok > 0 && (
                  <span className="text-xs text-default-400 font-mono">
                    {Math.round((1 - customTTok / customJTok) * 100)}% smaller
                  </span>
                )}
              </div>
              <CardBody className="p-0">
                <ScrollShadow className="h-[360px]">
                  <pre className="px-4 py-3 text-xs leading-relaxed font-mono whitespace-pre-wrap break-words text-default-500">{customJson}</pre>
                </ScrollShadow>
              </CardBody>
            </Card>
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-default-200">
                <span className="text-xs text-default-500">toon {customTTok > 0 && <span className="font-mono text-default-400">{customTTok}</span>}</span>
              </div>
              <CardBody className="p-0">
                <ScrollShadow className="h-[360px]">
                  <pre className="px-4 py-3 text-xs leading-relaxed font-mono whitespace-pre-wrap break-words text-default-500">{customToon}</pre>
                </ScrollShadow>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}
