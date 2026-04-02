import { decode } from "@toon-format/toon";
import type { DecodedJsonRender } from "./spec.js";

type ToonDecodeMode = "strict" | "repaired-strict" | "repaired-lenient" | "lenient";

export interface ToonDecodeResult {
  mode: ToonDecodeMode;
  value: DecodedJsonRender;
}

/**
 * Decode a TOON string into a json-render component spec.
 * Handles both single components and arrays of components.
 */
export function decodeToonToSpec(toon: string): DecodedJsonRender {
  return decodeToonWithRecovery(toon).value;
}

/**
 * Decode a complete TOON response from an LLM into json-render specs.
 * Strips any markdown fences or preamble the model may have added.
 */
export function decodeLLMResponse(response: string): DecodedJsonRender {
  return decodeToonWithRecovery(response).value;
}

export function decodeToonWithRecovery(toon: string): ToonDecodeResult {
  const cleaned = stripMarkdownFences(toon);
  const repaired = repairDeclaredArrayLengths(cleaned);

  const attempts: Array<{ mode: ToonDecodeMode; text: string; strict: boolean }> = [
    { mode: "strict", text: cleaned, strict: true },
  ];

  if (repaired !== cleaned) {
    attempts.push({ mode: "repaired-strict", text: repaired, strict: true });
    attempts.push({ mode: "repaired-lenient", text: repaired, strict: false });
  }

  attempts.push({ mode: "lenient", text: cleaned, strict: false });

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const parsed = decode(attempt.text, { strict: attempt.strict });
      return {
        mode: attempt.mode,
        value: parsed as unknown as DecodedJsonRender,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to decode TOON output");
}

/**
 * Incrementally decode TOON chunks as they arrive.
 * Buffers partial input and emits decoded specs when complete blocks are found.
 *
 * Block boundary detection: TOON specs are separated by blank lines.
 * Within a single spec, fields like component/props/children all sit at
 * indent 0, so we can't use indent-return-to-zero as a boundary.
 * Instead we split on blank lines that appear between top-level blocks.
 */
export function createStreamDecoder() {
  let buffer = "";

  return {
    /**
     * Feed a chunk of TOON text. Returns any fully decoded specs,
     * or null if still buffering.
     */
    push(chunk: string): DecodedJsonRender[] | null {
      buffer += chunk;

      // Split on double-newline (blank line between blocks).
      // A single TOON spec never contains a blank line between its fields,
      // so this is a safe boundary.
      const parts = buffer.split(/\n\n+/);
      if (parts.length < 2) return null;

      // Last part might be incomplete, keep it in buffer
      buffer = parts.pop()!;

      // Try to decode each complete block
      const completeBlocks = parts.filter(p => p.trim());

      // Normalize each block: decode and flatten arrays into individual specs
      const results: DecodedJsonRender[] = [];
      for (const block of completeBlocks) {
        const decoded = decodeToonToSpec(block);
        results.push(decoded);
      }
      return results;
    },

    /** Flush any remaining buffered content. */
    flush(): DecodedJsonRender | null {
      if (!buffer.trim()) return null;
      const result = decodeToonToSpec(buffer);
      buffer = "";
      return result;
    },
  };
}

function stripMarkdownFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:[^\r\n]*)?(?:\r?\n)?/, "")
    .replace(/(?:\r?\n)?```$/, "")
    .trim();
}

function repairDeclaredArrayLengths(toon: string): string {
  const lines = toon.split("\n");
  let changed = false;

  // Walk every line so all declared array headers are repaired before retrying decode.
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex];
    if (!rawLine.trim()) continue;

    const indent = countLeadingSpaces(rawLine);
    const content = rawLine.slice(indent);
    const header = parseDeclaredArrayHeader(content);
    if (!header) continue;

    const actualCount = header.inlineValues.trim()
      ? countInlineValues(header.inlineValues, header.delimiter)
      : countNestedArrayItems(
          lines,
          lineIndex,
          indent + 2,
          header.hasFields ? "tabular" : "list"
        );

    if (actualCount === header.declaredCount) continue;

    lines[lineIndex] =
      rawLine.slice(0, indent) +
      content.slice(0, header.countStart) +
      String(actualCount) +
      content.slice(header.countEnd);
    changed = true;
  }

  return changed ? lines.join("\n") : toon;
}

function countLeadingSpaces(line: string): number {
  let count = 0;
  while (count < line.length && line[count] === " ") count++;
  return count;
}

function countInlineValues(input: string, delimiter: string): number {
  if (!input.trim()) return 0;

  let count = 0;
  let inQuotes = false;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\" && inQuotes) {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      count++;
    }
  }

  return count + 1;
}

function countNestedArrayItems(
  lines: string[],
  headerIndex: number,
  itemIndent: number,
  kind: "list" | "tabular"
): number {
  let count = 0;

  for (let index = headerIndex + 1; index < lines.length; index++) {
    const rawLine = lines[index];
    if (!rawLine.trim()) continue;

    const indent = countLeadingSpaces(rawLine);
    if (indent < itemIndent) break;
    if (indent !== itemIndent) continue;

    const content = rawLine.slice(indent);
    const isListItem = content === "-" || content.startsWith("- ");

    if (kind === "list") {
      if (!isListItem) break;
    } else if (isListItem) {
      break;
    }

    count++;
  }

  return count;
}

function parseDeclaredArrayHeader(content: string): {
  declaredCount: number;
  delimiter: string;
  hasFields: boolean;
  inlineValues: string;
  countStart: number;
  countEnd: number;
} | null {
  let bracketStart = -1;
  let bracketEnd = -1;
  let colonIndex = -1;
  let inQuotes = false;
  let escaped = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\" && inQuotes) {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (inQuotes) continue;

    if (char === "[" && bracketStart === -1) {
      bracketStart = index;
      continue;
    }

    if (char === "]" && bracketStart !== -1 && bracketEnd === -1) {
      bracketEnd = index;
      continue;
    }

    if (char === ":" && bracketEnd !== -1) {
      colonIndex = index;
      break;
    }
  }

  if (bracketStart === -1 || bracketEnd === -1 || colonIndex === -1) {
    return null;
  }

  const bracketContent = content.slice(bracketStart + 1, bracketEnd);
  const match = bracketContent.match(/^(\d+)([,\t|]?)$/);
  if (!match) return null;

  const countText = match[1];
  return {
    declaredCount: Number.parseInt(countText, 10),
    delimiter: match[2] || ",",
    hasFields: content.slice(bracketEnd + 1, colonIndex).includes("{"),
    inlineValues: content.slice(colonIndex + 1),
    countStart: bracketStart + 1,
    countEnd: bracketStart + 1 + countText.length,
  };
}
