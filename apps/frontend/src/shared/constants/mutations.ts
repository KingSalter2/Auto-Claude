/**
 * Constants for GitHub Issues mutations and bulk operations.
 * Validation limits, patterns, and bulk operation configuration.
 */
import type { BulkActionType } from '../types/mutations';

// ============================================
// Validation Limits
// ============================================

export const TITLE_MAX_LENGTH = 256;
export const BODY_MAX_LENGTH = 65_536;
export const COMMENT_MAX_LENGTH = 65_536;
export const TITLE_COUNTER_THRESHOLD = 200;
export const BODY_COUNTER_THRESHOLD = 60_000;
export const GITHUB_LABEL_LIMIT = 100;

// ============================================
// Bulk Operation Configuration
// ============================================

/** Inter-item delay for bulk operations (ms) to avoid rate limits */
export const BULK_INTER_ITEM_DELAY = 100;

/** Maximum number of issues in a single bulk operation */
export const BULK_MAX_BATCH_SIZE = 50;

// ============================================
// Validation Patterns
// ============================================

/** Valid GitHub label characters: word chars, spaces, hyphens, dots, colons, slashes */
export const LABEL_PATTERN = /^[\w\s\-.:/]+$/;

/** Valid GitHub username pattern: alphanumeric + single hyphens, 1-39 chars */
export const GITHUB_LOGIN_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

// ============================================
// Bulk Action Labels (fallback; components use i18n keys)
// ============================================

export const BULK_ACTION_LABELS: Record<BulkActionType, string> = {
  close: 'Close',
  reopen: 'Reopen',
  'add-label': 'Add Label',
  'remove-label': 'Remove Label',
  'add-assignee': 'Assign',
  'remove-assignee': 'Unassign',
};
