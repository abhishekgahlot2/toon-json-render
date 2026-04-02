import {
  decodeToonWithRecovery,
  type ToonDecodeResult,
} from "./decoder.js";
import {
  isFlatSpec,
  isTreeSpec,
  toRenderableTree,
  type DecodedJsonRender,
  type JsonRenderSpec,
} from "./spec.js";

/**
 * RFC 6902-style JSON Patch for incremental UI updates.
 */
export interface StreamPatch {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
}

export interface CompilerOptions {
  /** Emit skeleton layout before props are complete (default: true) */
  skeletonFirst?: boolean;
  /** Validate against catalog on finalize (default: true) */
  validateOnFinalize?: boolean;
  /** Allowed component names — unknown components produce validation errors */
  catalog?: string[];
  /** Fall back to JSON parsing if TOON decode fails (default: true) */
  jsonFallback?: boolean;
}

/**
 * Streaming TOON → json-render compiler.
 *
 * Buffers incoming TOON text line-by-line, decodes complete blocks,
 * and emits replace patches when the decoded spec changes. This enables
 * progressive rendering without waiting for the full response.
 *
 * Strategy:
 * 1. Buffer network chunks into complete lines
 * 2. Feed complete lines to TOON decoder
 * 3. On successful decode, emit replace patch with updated spec
 * 4. On stream end, run strict final decode + validation
 */
export class ToonStreamCompiler {
  private buffer = "";
  private lines: string[] = [];
  private partialSpec: DecodedJsonRender | null = null;
  private patches: StreamPatch[] = [];
  private opts: Required<CompilerOptions>;
  private finalized = false;

  constructor(options: CompilerOptions = {}) {
    this.opts = {
      skeletonFirst: options.skeletonFirst ?? true,
      validateOnFinalize: options.validateOnFinalize ?? true,
      catalog: options.catalog ?? [],
      jsonFallback: options.jsonFallback ?? true,
    };
  }

  /**
   * Push a chunk of text from the LLM stream.
   * Returns any patches ready to be applied to the renderer.
   * Throws if called after finalize().
   */
  push(chunk: string): StreamPatch[] {
    if (this.finalized) {
      throw new Error("Compiler already finalized");
    }

    this.buffer += chunk;
    const newPatches: StreamPatch[] = [];

    // Split on newlines, keep last incomplete line in buffer
    const parts = this.buffer.split("\n");
    this.buffer = parts.pop() ?? "";

    for (const line of parts) {
      this.lines.push(line);

      // Try to decode accumulated lines as a complete TOON block
      const accumulated = this.lines.join("\n");
      const spec = this.tryDecode(accumulated);

      if (spec) {
        if (this.partialSpec === null) {
          // First successful decode — emit full spec as initial patch
          newPatches.push({
            op: "add",
            path: "/",
            value: spec,
          });
        } else {
          // Subsequent decode — emit replace if changed
          const diff = this.diffSpecs(this.partialSpec, spec);
          newPatches.push(...diff);
        }
        this.partialSpec = spec;
      } else if (this.opts.skeletonFirst && this.lines.length > 0) {
        // Try to emit a skeleton (component name without full props)
        const skeleton = this.tryDecodeSkeleton(accumulated);
        if (skeleton && !this.partialSpec) {
          newPatches.push({
            op: "add",
            path: "/",
            value: skeleton,
          });
          this.partialSpec = skeleton;
        }
      }
    }

    this.patches.push(...newPatches);
    return newPatches;
  }

  /**
   * Finalize the stream. Decodes any remaining buffer,
   * runs strict validation, and returns the complete spec.
   * Throws if called more than once.
   */
  finalize(): { spec: DecodedJsonRender | null; patches: StreamPatch[]; errors: string[] } {
    if (this.finalized) {
      throw new Error("Compiler already finalized");
    }
    this.finalized = true;
    const errors: string[] = [];
    const finalPatches: StreamPatch[] = [];

    // Flush remaining buffer
    if (this.buffer.trim()) {
      this.lines.push(this.buffer);
      this.buffer = "";
    }

    const fullText = this.lines.join("\n");
    const decoded = this.tryDecodeResult(fullText);
    let finalSpec = decoded?.spec ?? null;

    // JSON fallback
    if (!finalSpec && this.opts.jsonFallback) {
      finalSpec = this.tryJsonFallback(fullText);
      if (finalSpec) {
        errors.push("TOON decode failed, fell back to JSON parsing");
      }
    }

    if (!finalSpec) {
      errors.push("Failed to decode TOON output");
      return { spec: this.partialSpec, patches: finalPatches, errors };
    }

    // Validate against catalog
    if (this.opts.validateOnFinalize && this.opts.catalog.length > 0) {
      const validationErrors = this.validateAgainstCatalog(finalSpec);
      errors.push(...validationErrors);
    }

    // Emit final patch
    if (this.partialSpec) {
      const diff = this.diffSpecs(this.partialSpec, finalSpec);
      finalPatches.push(...diff);
    } else {
      finalPatches.push({ op: "add", path: "/", value: finalSpec });
    }

    // Track final patches in the cumulative list
    this.patches.push(...finalPatches);
    this.partialSpec = finalSpec;
    return { spec: finalSpec, patches: finalPatches, errors };
  }

  /** Get the current partial spec. */
  getPartialSpec(): DecodedJsonRender | null {
    return this.partialSpec;
  }

  /** Get all patches emitted so far, including from finalize(). */
  getAllPatches(): StreamPatch[] {
    return [...this.patches];
  }

  private tryDecode(text: string): DecodedJsonRender | null {
    try {
      return this.tryDecodeResult(text)?.spec ?? null;
    } catch {
      return null;
    }
  }

  private tryDecodeSkeleton(text: string): DecodedJsonRender | null {
    const rootMatch = text.match(/root\s*:\s*([A-Za-z0-9_-]+)/);
    const typeMatch = text.match(/\n\s*type\s*:\s*([A-Za-z0-9_-]+)/);
    if (rootMatch && typeMatch) {
      return {
        root: rootMatch[1],
        elements: {
          [rootMatch[1]]: { type: typeMatch[1] },
        },
      };
    }

    const componentMatch = text.match(/component\s*[:=]\s*(\w+)/);
    if (componentMatch) return { component: componentMatch[1], props: {} };
    return null;
  }

  private tryJsonFallback(text: string): DecodedJsonRender | null {
    try {
      const stripped = this.stripFences(text);
      const parsed = JSON.parse(stripped);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as JsonRenderSpec[];
      if (parsed && typeof parsed === "object") return parsed as DecodedJsonRender;
      return null;
    } catch {
      return null;
    }
  }

  private stripFences(text: string): string {
    const fenceRegex = /```(?:toon|json)?\s*\n([\s\S]*?)\n```/m;
    const match = text.match(fenceRegex);
    if (match) return match[1];
    return text.trim();
  }

  private tryDecodeResult(
    text: string
  ): { spec: DecodedJsonRender; mode: ToonDecodeResult["mode"] } | null {
    try {
      const result = decodeToonWithRecovery(text);
      const spec = this.normalizeDecodedRoot(result.value);
      if (!spec) return null;
      return { spec, mode: result.mode };
    } catch {
      return null;
    }
  }

  private normalizeDecodedRoot(parsed: DecodedJsonRender): DecodedJsonRender | null {
    if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : null;
    if (isTreeSpec(parsed) || isFlatSpec(parsed)) return parsed;
    return null;
  }
  private diffSpecs(prev: DecodedJsonRender, next: DecodedJsonRender): StreamPatch[] {
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      return [{ op: "replace", path: "/", value: next }];
    }
    return [];
  }

  private validateAgainstCatalog(spec: DecodedJsonRender): string[] {
    const errors: string[] = [];

    if (isFlatSpec(spec)) {
      for (const [key, element] of Object.entries(spec.elements)) {
        if (!this.opts.catalog.includes(element.type)) {
          errors.push(`Unknown component "${element.type}" at /elements/${key}`);
        }
      }
      return errors;
    }

    const renderable = toRenderableTree(spec);
    const roots = Array.isArray(renderable) ? renderable : renderable ? [renderable] : [];
    const walk = (node: JsonRenderSpec, path: string) => {
      if (
        this.opts.catalog.length > 0 &&
        node.component !== "Fragment" &&
        !this.opts.catalog.includes(node.component)
      ) {
        errors.push(`Unknown component "${node.component}" at ${path}`);
      }
      node.children?.forEach((child, i) => {
        walk(child, `${path}/children/${i}`);
      });
    };
    roots.forEach((root, index) => walk(root, `/${index}`));
    return errors;
  }
}

/**
 * Create a TransformStream that converts TOON text chunks to StreamPatches.
 * Compatible with AI SDK streaming patterns.
 * Surfaces decode/validation errors from finalize().
 */
export function createToonTransform(
  options: CompilerOptions = {}
): TransformStream<string, StreamPatch[]> {
  const compiler = new ToonStreamCompiler(options);

  return new TransformStream({
    transform(chunk, controller) {
      const patches = compiler.push(chunk);
      if (patches.length > 0) {
        controller.enqueue(patches);
      }
    },
    flush(controller) {
      const { spec, patches, errors } = compiler.finalize();
      if (patches.length > 0) {
        controller.enqueue(patches);
      }
      // Only error if we got no usable spec at all.
      // Recoverable warnings (e.g. "fell back to JSON") are not fatal.
      if (!spec && errors.length > 0) {
        controller.error(new Error(errors.join("; ")));
      }
    },
  });
}
