import { Button, Snippet, Link } from "@heroui/react";

export default function Footer() {
  return (
    <>
      <section className="px-4 py-16 text-center">
        <h2 className="mb-2 text-2xl font-bold">Get started</h2>
        <p className="mb-6 text-sm text-default-400">Install and start saving tokens.</p>
        <Snippet symbol="$" variant="bordered" className="mb-6">
          pnpm add @toon-json-render/core @toon-json-render/react
        </Snippet>
        <div className="flex gap-3 justify-center">
          <Button color="primary" as="a" href="https://github.com/abhishekgahlot2/toon-json-render">
            GitHub
          </Button>
          <Button variant="bordered" as="a" href="https://www.npmjs.com/package/@toon-json-render/core">
            npm
          </Button>
        </div>
      </section>
      <footer className="px-4 py-4 text-center text-xs text-default-400 border-t border-default-100">
        <Link size="sm" href="https://github.com/abhishekgahlot2/toon-json-render" className="text-default-400">GitHub</Link>
        {" · "}
        <Link size="sm" href="https://toonformat.dev/" className="text-default-400">TOON</Link>
        {" · "}
        <Link size="sm" href="https://json-render.dev/" className="text-default-400">json-render</Link>
        {" · MIT License"}
      </footer>
    </>
  );
}
