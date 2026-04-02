import { useState, useCallback, useRef } from "react";
import {
  createStreamDecoder,
  toRenderableTree,
  type DecodedJsonRender,
  type JsonRenderSpec,
} from "@toon-json-render/core";

export interface ToonStreamOptions {
  /** Called when a new complete spec block is decoded */
  onSpec?: (spec: JsonRenderSpec) => void;
  /** Called when the stream is complete */
  onComplete?: (specs: JsonRenderSpec[]) => void;
  /** Called on decode error */
  onError?: (error: Error) => void;
}

/**
 * React hook for streaming TOON responses from an LLM.
 *
 * Buffers incoming TOON chunks and progressively decodes complete
 * component blocks, enabling partial rendering as the response arrives.
 *
 * This bridges the streaming gap — while TOON can't stream line-by-line
 * like JSONL, this hook decodes complete top-level blocks as they arrive,
 * giving progressive rendering at the block level.
 */
export function useToonStream(options: ToonStreamOptions = {}) {
  const { onSpec, onComplete, onError } = options;
  const [specs, setSpecs] = useState<JsonRenderSpec[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const decoderRef = useRef(createStreamDecoder());

  const normalizeDecoded = useCallback((value: DecodedJsonRender): JsonRenderSpec[] => {
    const renderable = toRenderableTree(value);
    if (!renderable) return [];
    return Array.isArray(renderable) ? renderable : [renderable];
  }, []);

  const push = useCallback(
    (chunk: string) => {
      try {
        const decoded = decoderRef.current.push(chunk);
        if (decoded) {
          setSpecs((prev) => {
            const normalized = decoded.flatMap((entry) => normalizeDecoded(entry));
            const next = [...prev, ...normalized];
            normalized.forEach((s) => onSpec?.(s));
            return next;
          });
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        onError?.(err);
      }
    },
    [normalizeDecoded, onSpec, onError]
  );

  const finish = useCallback(() => {
    try {
      const remaining = decoderRef.current.flush();
      if (remaining) {
        const arr = normalizeDecoded(remaining);
        setSpecs((prev) => {
          const next = [...prev, ...arr];
          onComplete?.(next);
          return next;
        });
      } else {
        setSpecs((prev) => {
          onComplete?.(prev);
          return prev;
        });
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      onError?.(err);
    }
    setIsStreaming(false);
  }, [normalizeDecoded, onComplete, onError]);

  const start = useCallback(() => {
    decoderRef.current = createStreamDecoder();
    setSpecs([]);
    setError(null);
    setIsStreaming(true);
  }, []);

  /**
   * Connect to a ReadableStream (e.g. from fetch) and progressively decode.
   */
  const connectStream = useCallback(
    async (stream: ReadableStream<string>) => {
      start();
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          push(value);
        }
        finish();
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        onError?.(err);
        setIsStreaming(false);
      }
    },
    [start, push, finish, onError]
  );

  return {
    specs,
    isStreaming,
    error,
    push,
    start,
    finish,
    connectStream,
  };
}
