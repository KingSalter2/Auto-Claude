/**
 * Tests for Structured Output Validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  validateStructuredOutput,
  validateJsonFile,
  validateAndNormalizeJsonFile,
  formatZodErrors,
  buildValidationRetryPrompt,
} from '../structured-output';

const testSchema = z.object({
  name: z.string(),
  age: z.number(),
  tags: z.array(z.string()).optional(),
});

describe('validateStructuredOutput', () => {
  it('returns valid with coerced data on success', () => {
    const result = validateStructuredOutput({ name: 'Alice', age: 30 }, testSchema);
    expect(result.valid).toBe(true);
    expect(result.data).toEqual({ name: 'Alice', age: 30 });
    expect(result.errors).toEqual([]);
  });

  it('returns errors on failure', () => {
    const result = validateStructuredOutput({ name: 123 }, testSchema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.data).toBeUndefined();
  });
});

describe('validateJsonFile', () => {
  const testDir = join(tmpdir(), `schema-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('validates a well-formed JSON file', async () => {
    const filePath = join(testDir, 'good.json');
    writeFileSync(filePath, JSON.stringify({ name: 'Bob', age: 25 }));

    const result = await validateJsonFile(filePath, testSchema);
    expect(result.valid).toBe(true);
    expect(result.data).toEqual({ name: 'Bob', age: 25 });
  });

  it('returns error for missing file', async () => {
    const result = await validateJsonFile(join(testDir, 'missing.json'), testSchema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('File not found');
  });

  it('returns error for invalid JSON syntax', async () => {
    const filePath = join(testDir, 'bad.json');
    writeFileSync(filePath, '{ this is not json at all!!!');

    const result = await validateJsonFile(filePath, testSchema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid JSON syntax');
  });

  it('repairs JSON with trailing commas before validating', async () => {
    const filePath = join(testDir, 'trailing.json');
    writeFileSync(filePath, '{ "name": "Eve", "age": 28, }');

    const result = await validateJsonFile(filePath, testSchema);
    expect(result.valid).toBe(true);
    expect(result.data?.name).toBe('Eve');
  });

  it('repairs JSON with markdown fences before validating', async () => {
    const filePath = join(testDir, 'fenced.json');
    writeFileSync(filePath, '```json\n{ "name": "Eve", "age": 28 }\n```');

    const result = await validateJsonFile(filePath, testSchema);
    expect(result.valid).toBe(true);
    expect(result.data?.name).toBe('Eve');
  });
});

describe('validateAndNormalizeJsonFile', () => {
  const testDir = join(tmpdir(), `normalize-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('writes back normalized data', async () => {
    const schema = z.preprocess(
      (val: unknown) => {
        if (!val || typeof val !== 'object') return val;
        const raw = val as Record<string, unknown>;
        return { ...raw, name: raw.name ?? raw.title };
      },
      z.object({ name: z.string(), age: z.number() }),
    );

    const filePath = join(testDir, 'normalize.json');
    writeFileSync(filePath, JSON.stringify({ title: 'Alice', age: 30 }));

    const result = await validateAndNormalizeJsonFile(filePath, schema);
    expect(result.valid).toBe(true);

    // Read back the file — should have the normalized field name
    const { readFileSync } = await import('node:fs');
    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.name).toBe('Alice');
  });
});

describe('formatZodErrors', () => {
  it('formats invalid_type errors', () => {
    const result = testSchema.safeParse({ name: 123, age: 'not a number' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(errors.length).toBeGreaterThan(0);
      errors.forEach((e) => {
        expect(typeof e).toBe('string');
        expect(e.length).toBeGreaterThan(0);
      });
    }
  });

  it('formats custom refine errors', () => {
    const schema = z.object({ x: z.number() }).refine((v) => v.x > 0, {
      message: 'x must be positive',
    });
    const result = schema.safeParse({ x: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(errors.some((e) => e.includes('x must be positive'))).toBe(true);
    }
  });
});

describe('buildValidationRetryPrompt', () => {
  it('includes file name and errors', () => {
    const prompt = buildValidationRetryPrompt('plan.json', [
      'At "phases.0.subtasks.0.description": expected string, received undefined',
    ]);
    expect(prompt).toContain('plan.json');
    expect(prompt).toContain('expected string');
    expect(prompt).toContain('INVALID');
  });

  it('includes schema hint when provided', () => {
    const prompt = buildValidationRetryPrompt('plan.json', ['error'], '{ "phases": [...] }');
    expect(prompt).toContain('{ "phases": [...] }');
    expect(prompt).toContain('Required schema');
  });

  it('includes common field name guidance', () => {
    const prompt = buildValidationRetryPrompt('plan.json', ['error']);
    expect(prompt).toContain('"description"');
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"id"');
  });
});
