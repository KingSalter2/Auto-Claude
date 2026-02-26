/**
 * Implementation Plan Schema
 * ==========================
 *
 * Zod schema for validating and coercing implementation_plan.json.
 *
 * LLMs produce field name variations (title vs description, subtask_id vs id, etc.).
 * This schema handles coercion of known aliases via `z.preprocess()` so validation
 * succeeds even when models deviate from the exact spec — while still ensuring
 * all required data is present.
 */

import { z } from 'zod';

// =============================================================================
// Subtask Status Enum
// =============================================================================

const SUBTASK_STATUS_VALUES = ['pending', 'in_progress', 'completed', 'blocked', 'failed'] as const;

/**
 * Coerces common status variations to canonical values.
 * LLMs frequently output "done", "complete", "not_started", "todo", etc.
 */
function normalizeStatus(value: unknown): string {
  if (typeof value !== 'string') return 'pending';
  const lower = value.toLowerCase().trim();

  // Map common LLM variations to canonical values
  const statusMap: Record<string, string> = {
    done: 'completed',
    complete: 'completed',
    finished: 'completed',
    success: 'completed',
    not_started: 'pending',
    todo: 'pending',
    queued: 'pending',
    backlog: 'pending',
    running: 'in_progress',
    active: 'in_progress',
    wip: 'in_progress',
    working: 'in_progress',
    stuck: 'blocked',
    waiting: 'blocked',
    error: 'failed',
    errored: 'failed',
  };

  return statusMap[lower] ?? (SUBTASK_STATUS_VALUES.includes(lower as typeof SUBTASK_STATUS_VALUES[number]) ? lower : 'pending');
}

// =============================================================================
// Subtask Schema (with coercion)
// =============================================================================

/**
 * Preprocessor that normalizes LLM field name variations before Zod validation.
 * Handles: title→description, subtask_id→id, name→description, file_paths→files_to_modify
 */
function coerceSubtask(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const raw = input as Record<string, unknown>;

  return {
    ...raw,
    // Coerce id: accept subtask_id, task_id as aliases
    id: raw.id ?? raw.subtask_id ?? raw.task_id ?? undefined,
    // Coerce description: accept title, name, summary as aliases
    description: raw.description ?? raw.title ?? raw.name ?? raw.summary ?? undefined,
    // Normalize status
    status: normalizeStatus(raw.status),
    // Coerce files_to_modify: accept file_paths as alias
    files_to_modify: raw.files_to_modify ?? raw.file_paths ?? undefined,
    // Coerce files_to_create: accept new_files as alias
    files_to_create: raw.files_to_create ?? raw.new_files ?? undefined,
  };
}

export const PlanSubtaskSchema = z.preprocess(coerceSubtask, z.object({
  id: z.string({ message: 'Subtask must have an "id" field' }),
  description: z.string({ message: 'Subtask must have a "description" (or "title") field' }),
  status: z.enum(SUBTASK_STATUS_VALUES).default('pending'),
  files_to_create: z.array(z.string()).optional(),
  files_to_modify: z.array(z.string()).optional(),
  verification: z.object({
    type: z.string(),
    run: z.string().optional(),
    scenario: z.string().optional(),
  }).optional(),
  // Passthrough unknown fields so we don't lose data the LLM added
}).passthrough());

// =============================================================================
// Phase Schema (with coercion)
// =============================================================================

function coercePhase(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const raw = input as Record<string, unknown>;

  return {
    ...raw,
    // Coerce id: accept phase_id as alias, or convert phase number to string id
    id: raw.id ?? raw.phase_id ?? (raw.phase !== undefined ? String(raw.phase) : undefined),
    // Coerce name: accept title as alias
    name: raw.name ?? raw.title ?? (raw.id ? String(raw.id) : undefined) ?? 'Phase',
    // Coerce subtasks: accept chunks, tasks as aliases
    subtasks: raw.subtasks ?? raw.chunks ?? raw.tasks ?? undefined,
  };
}

export const PlanPhaseSchema = z.preprocess(coercePhase, z.object({
  id: z.union([z.string(), z.number().transform(String)]).optional(),
  phase: z.number().optional(),
  name: z.string({ message: 'Phase must have a "name" (or "title") field' }),
  subtasks: z.array(PlanSubtaskSchema, { message: 'Phase must have a "subtasks" array' }).min(1, 'Phase must have at least one subtask'),
  depends_on: z.array(z.union([z.string(), z.number()])).optional(),
}).passthrough())
  // Ensure at least one of id or phase is present
  .refine(
    (phase) => phase.id !== undefined || phase.phase !== undefined,
    { message: 'Phase must have either "id" or "phase" field' }
  );

// =============================================================================
// Implementation Plan Schema (top-level)
// =============================================================================

function coercePlan(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const raw = input as Record<string, unknown>;

  return {
    ...raw,
    // Coerce feature: accept title, name as aliases
    feature: raw.feature ?? raw.title ?? raw.name ?? undefined,
    // Coerce workflow_type: accept type as alias
    workflow_type: raw.workflow_type ?? raw.type ?? undefined,
  };
}

export const ImplementationPlanSchema = z.preprocess(coercePlan, z.object({
  feature: z.string().optional(),
  workflow_type: z.string().optional(),
  phases: z.array(PlanPhaseSchema, { message: 'Plan must have a "phases" array' }).min(1, 'Plan must have at least one phase'),
}).passthrough());

// =============================================================================
// Inferred Types
// =============================================================================

export type ValidatedPlanSubtask = z.infer<typeof PlanSubtaskSchema>;
export type ValidatedPlanPhase = z.infer<typeof PlanPhaseSchema>;
export type ValidatedImplementationPlan = z.infer<typeof ImplementationPlanSchema>;
