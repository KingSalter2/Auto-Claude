/**
 * Structured Output Validation
 * ============================
 *
 * Provider-agnostic validation for LLM-generated structured data.
 *
 * Two approaches for different scenarios:
 *
 * 1. **Post-session file validation** — For agents that write JSON files via tools
 *    (planner, roadmap, etc.). Read the file, validate with Zod, retry with
 *    error feedback if invalid.
 *
 * 2. **Inline Output.object()** — For agents that return structured text
 *    (complexity assessor, PR scan, etc.). Uses AI SDK's built-in structured
 *    output which validates against Zod at the provider level.
 *
 * This module provides the post-session validation utility. The inline approach
 * is handled by passing `outputSchema` in SessionConfig → runner.ts.
 */

import type { ZodSchema, ZodError } from 'zod';
import { readFile, writeFile } from 'node:fs/promises';
import { safeParseJson } from '../../utils/json-repair';

// =============================================================================
// LLM Text → Typed Data Helper
// =============================================================================

/**
 * Parse LLM text output into a typed object via Zod schema.
 *
 * Handles the common pattern where an LLM returns JSON in its text response
 * (possibly wrapped in markdown fences, with trailing commas, etc.).
 *
 * Steps:
 * 1. Strip markdown code fences (`\`\`\`json ... \`\`\``)
 * 2. Repair common JSON syntax issues (trailing commas, missing brackets)
 * 3. Validate and coerce via Zod schema
 *
 * Returns null if parsing or validation fails — callers should provide
 * their own fallback value.
 */
export function parseLLMJson<T>(text: string, schema: ZodSchema<T>): T | null {
  if (!text?.trim()) return null;

  // Strip markdown fences
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1];
  }

  // Repair + parse
  const parsed = safeParseJson<unknown>(cleaned);
  if (parsed === null) return null;

  // Validate with Zod schema (includes coercion transforms)
  const result = schema.safeParse(parsed);
  return result.success ? result.data : null;
}

// =============================================================================
// Validation Result
// =============================================================================

export interface StructuredOutputValidation<T> {
  /** Whether the data passed validation */
  valid: boolean;
  /** The validated and coerced data (only when valid=true) */
  data?: T;
  /** Human-readable error messages for LLM feedback */
  errors: string[];
  /** The raw data before validation (for debugging) */
  raw?: unknown;
}

// =============================================================================
// Core Validation
// =============================================================================

/**
 * Validate raw data against a Zod schema.
 * Returns coerced data on success, human-readable errors on failure.
 */
export function validateStructuredOutput<T>(
  raw: unknown,
  schema: ZodSchema<T>,
): StructuredOutputValidation<T> {
  const result = schema.safeParse(raw);

  if (result.success) {
    return { valid: true, data: result.data, errors: [], raw };
  }

  return {
    valid: false,
    errors: formatZodErrors(result.error),
    raw,
  };
}

/**
 * Read a JSON file, repair syntax if needed, then validate against a Zod schema.
 * This is the primary entry point for post-session file validation.
 *
 * @param filePath - Path to the JSON file written by an agent
 * @param schema - Zod schema to validate against
 * @returns Validation result with coerced data or human-readable errors
 */
export async function validateJsonFile<T>(
  filePath: string,
  schema: ZodSchema<T>,
): Promise<StructuredOutputValidation<T>> {
  let rawContent: string;
  try {
    rawContent = await readFile(filePath, 'utf-8');
  } catch {
    return { valid: false, errors: [`File not found: ${filePath}`] };
  }

  // Step 1: Parse JSON (with syntax repair for LLM quirks)
  const parsed = safeParseJson<unknown>(rawContent);
  if (parsed === null) {
    return {
      valid: false,
      errors: [
        'Invalid JSON syntax that could not be auto-repaired.',
        'The file must contain valid JSON. Common issues:',
        '- Trailing commas after the last item in arrays/objects',
        '- Missing commas between items',
        '- Unquoted property names',
        '- Markdown code fences (```json) wrapping the content',
      ],
    };
  }

  // Step 2: Validate against schema (with coercion)
  return validateStructuredOutput(parsed, schema);
}

/**
 * Validate a JSON file and write the coerced (normalized) data back.
 * This replaces both normalizeSubtaskIds() and validateImplementationPlan()
 * in build-orchestrator — Zod coercion handles field normalization, and
 * writing back ensures the file matches the canonical schema.
 *
 * @param filePath - Path to the JSON file
 * @param schema - Zod schema with coercion transforms
 * @returns Validation result
 */
export async function validateAndNormalizeJsonFile<T>(
  filePath: string,
  schema: ZodSchema<T>,
): Promise<StructuredOutputValidation<T>> {
  const result = await validateJsonFile(filePath, schema);

  if (result.valid && result.data) {
    // Write back the coerced data so downstream consumers get canonical field names
    await writeFile(filePath, JSON.stringify(result.data, null, 2));
  }

  return result;
}

// =============================================================================
// LLM Error Formatting
// =============================================================================

/**
 * Format Zod validation errors into LLM-friendly messages.
 *
 * Instead of cryptic Zod error codes, produces clear natural language
 * that tells the LLM exactly what to fix. This is the feedback loop
 * that makes schema validation work with any model.
 */
export function formatZodErrors(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';

    // Zod v4 uses different issue shapes than v3.
    // Use the human-readable `message` field which is always present.
    switch (issue.code) {
      case 'invalid_type': {
        const expected = (issue as { expected?: string }).expected;
        return `At "${path}": ${expected ? `expected ${expected}` : issue.message}`;
      }
      case 'invalid_value': {
        // Zod v4: enum validation → "invalid_value" with "values" array
        const values = (issue as { values?: unknown[] }).values;
        return values
          ? `At "${path}": must be one of [${values.join(', ')}]`
          : `At "${path}": ${issue.message}`;
      }
      case 'too_small': {
        const origin = (issue as { origin?: string }).origin;
        const minimum = (issue as { minimum?: number }).minimum;
        if (origin === 'array' && minimum !== undefined) {
          return `At "${path}": array must have at least ${minimum} item(s)`;
        }
        return `At "${path}": ${issue.message}`;
      }
      case 'custom':
        return `At "${path}": ${issue.message}`;
      default:
        return `At "${path}": ${issue.message}`;
    }
  });
}

/**
 * Build an LLM-friendly retry prompt from validation errors.
 *
 * This is what gets fed back to the model when its output doesn't match
 * the schema. The errors are specific enough for any model (including
 * local/smaller ones) to understand what needs fixing.
 */
export function buildValidationRetryPrompt(
  fileName: string,
  errors: string[],
  schemaHint?: string,
): string {
  const lines = [
    `## STRUCTURED OUTPUT VALIDATION ERRORS`,
    ``,
    `The \`${fileName}\` you wrote is INVALID. You MUST rewrite it.`,
    ``,
    `### Errors found:`,
    ...errors.map((e) => `- ${e}`),
    ``,
  ];

  if (schemaHint) {
    lines.push(`### Required schema:`, schemaHint, ``);
  }

  lines.push(
    `### How to fix:`,
    `1. Read the current \`${fileName}\` to see what you wrote`,
    `2. Fix each error listed above`,
    `3. Rewrite the file with the corrected JSON using the Write tool`,
    ``,
    `Common field name issues:`,
    `- Use "description" (not "title" or "name") for subtask descriptions`,
    `- Use "id" (not "subtask_id" or "task_id") for subtask identifiers`,
    `- Use "status" with value "pending" for new subtasks`,
    `- Use "name" for phase names, "subtasks" for the subtask array`,
  );

  return lines.join('\n');
}

/** Schema hint for the implementation plan (used in retry prompts) */
export const IMPLEMENTATION_PLAN_SCHEMA_HINT = `\`\`\`
{
  "feature": "string (feature name)",
  "workflow_type": "string (feature|refactor|bugfix|migration|simple|investigation)",
  "phases": [
    {
      "id": "string or number",
      "name": "string (phase name)",
      "subtasks": [
        {
          "id": "string (unique subtask identifier)",
          "description": "string (what this subtask does)",
          "status": "pending",
          "files_to_modify": ["string (optional)"],
          "files_to_create": ["string (optional)"],
          "verification": { "type": "command|manual", "run": "string (optional)" }
        }
      ]
    }
  ]
}
\`\`\``;
