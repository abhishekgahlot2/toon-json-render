// Decoder
export {
  decodeToonToSpec,
  decodeLLMResponse,
  decodeToonWithRecovery,
  createStreamDecoder,
} from "./decoder.js";

// Spec types / normalization
export {
  getByPath,
  evaluateVisible,
  resolveValue,
  toRenderableTree,
  isFlatSpec,
  isTreeSpec,
  type JsonRenderSpec,
  type FlatElementSpec,
  type FlatJsonRenderSpec,
  type DecodedJsonRender,
} from "./spec.js";

// Prompt generation
export {
  generateSystemPrompt,
  generateExample,
  generateCompactCatalog,
  type ComponentDef,
  type PropDef,
  type CatalogConfig,
  type ActionDef,
  type PromptOptions,
} from "./prompt.js";

// Stream compiler
export {
  ToonStreamCompiler,
  createToonTransform,
  type StreamPatch,
  type CompilerOptions,
} from "./stream-compiler.js";

// Validation
export { validateSpec } from "./validate.js";
