import {
  isTreeSpec,
  normalizeFlatSpec,
  type DecodedJsonRender,
  type FlatJsonRenderSpec,
  type JsonRenderSpec,
} from "./spec.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a decoded json-render spec.
 * Never render unvalidated output directly — always pass through this first.
 */
export function validateSpec(
  spec: DecodedJsonRender,
  catalog?: string[]
): ValidationResult {
  const errors: string[] = [];
  if (Array.isArray(spec)) {
    for (const s of spec) {
      walkAndValidateTree(s, "/", catalog, errors);
    }
  } else if (isTreeSpec(spec)) {
    walkAndValidateTree(spec, "/", catalog, errors);
  } else {
    const normalized = normalizeFlatSpec(spec);
    if (normalized) {
      walkAndValidateFlat(normalized, "/", catalog, errors);
    } else {
      errors.push(`/: unsupported decoded spec shape`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function walkAndValidateTree(
  node: JsonRenderSpec,
  path: string,
  catalog: string[] | undefined,
  errors: string[]
): void {
  if (!node.component || typeof node.component !== "string") {
    errors.push(`${path}: missing or invalid "component" field`);
    return;
  }

  if (catalog && catalog.length > 0 && !catalog.includes(node.component)) {
    errors.push(`${path}: unknown component "${node.component}"`);
  }

  if (node.props !== undefined && (typeof node.props !== "object" || Array.isArray(node.props))) {
    errors.push(`${path}: "props" must be an object`);
  }

  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      errors.push(`${path}: "children" must be an array`);
    } else {
      node.children.forEach((child, i) => {
        walkAndValidateTree(child, `${path}/children/${i}`, catalog, errors);
      });
    }
  }
}

function walkAndValidateFlat(
  spec: FlatJsonRenderSpec,
  path: string,
  catalog: string[] | undefined,
  errors: string[]
): void {
  if (!spec.root || typeof spec.root !== "string") {
    errors.push(`${path}: missing or invalid "root" field`);
  }

  if (!spec.elements || typeof spec.elements !== "object" || Array.isArray(spec.elements)) {
    errors.push(`${path}: missing or invalid "elements" field`);
    return;
  }

  if (!(spec.root in spec.elements)) {
    errors.push(`${path}: root "${spec.root}" does not exist in "elements"`);
  }

  for (const [elementKey, element] of Object.entries(spec.elements)) {
    const elementPath = `${path}elements/${elementKey}`;
    if (!element || typeof element !== "object" || Array.isArray(element)) {
      errors.push(`${elementPath}: element must be an object`);
      continue;
    }

    const maybeType = element.type;
    if (typeof maybeType !== "string" || !maybeType) {
      errors.push(`${elementPath}: missing or invalid "type" field`);
    } else if (catalog && catalog.length > 0 && !catalog.includes(maybeType)) {
      errors.push(`${elementPath}: unknown component "${maybeType}"`);
    }

    const props = element.props;
    if (props !== undefined && (typeof props !== "object" || props === null || Array.isArray(props))) {
      errors.push(`${elementPath}: "props" must be an object`);
    }

    const children = element.children;
    if (children !== undefined) {
      if (!Array.isArray(children)) {
        errors.push(`${elementPath}: "children" must be an array`);
      } else {
        children.forEach((child, childIndex) => {
          if (typeof child !== "string") {
            errors.push(`${elementPath}/children/${childIndex}: child references must be strings`);
          } else if (!(child in spec.elements)) {
            errors.push(`${elementPath}/children/${childIndex}: missing child element "${child}"`);
          }
        });
      }
    }
  }
}
