import React, { useMemo } from "react";
import {
  decodeLLMResponse,
  toRenderableTree,
  type DecodedJsonRender,
  type JsonRenderSpec,
} from "@toon-json-render/core";

export type ComponentMap = Record<string, React.ComponentType<any>>;

export interface ToonRendererProps {
  /** Raw TOON string from LLM output (handles markdown fences) */
  toon?: string;
  /** Pre-decoded json-render spec (bypasses TOON decoding) */
  spec?: DecodedJsonRender;
  /** Map of component names to React components */
  components: ComponentMap;
  /** Fallback component for unknown component names */
  fallback?: React.ComponentType<{ name: string }>;
  /** Error boundary fallback */
  errorFallback?: React.ReactNode;
}

/**
 * Renders a TOON-encoded or pre-decoded json-render spec into React components.
 *
 * Accepts either a raw TOON string (from LLM, including markdown fences)
 * or a pre-decoded spec. Maps component names to your React component library.
 */
export function ToonRenderer({
  toon,
  spec: preDecodedSpec,
  components,
  fallback: FallbackComponent,
  errorFallback,
}: ToonRendererProps): React.ReactElement | null {
  const spec = useMemo(() => {
    if (preDecodedSpec) return toRenderableTree(preDecodedSpec);
    if (!toon) return null;
    try {
      return toRenderableTree(decodeLLMResponse(toon));
    } catch {
      return null;
    }
  }, [toon, preDecodedSpec]);

  if (!spec) {
    return errorFallback ? <>{errorFallback}</> : null;
  }

  const specs = Array.isArray(spec) ? spec : [spec];

  return (
    <>
      {specs.map((s, i) => (
        <RenderNode key={i} spec={s} components={components} fallback={FallbackComponent} />
      ))}
    </>
  );
}

function RenderNode({
  spec,
  components,
  fallback: FallbackComponent,
}: {
  spec: JsonRenderSpec;
  components: ComponentMap;
  fallback?: React.ComponentType<{ name: string }>;
}): React.ReactElement | null {
  const Component = components[spec.component];

  if (!Component) {
    if (FallbackComponent) {
      return <FallbackComponent name={spec.component} />;
    }
    return null;
  }

  const children = spec.children?.map((child, i) => (
    <RenderNode key={i} spec={child} components={components} fallback={FallbackComponent} />
  ));

  return <Component {...(spec.props || {})}>{children}</Component>;
}
