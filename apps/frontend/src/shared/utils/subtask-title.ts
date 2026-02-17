/**
 * Default maximum length for subtask titles.
 * Used by extractSubtaskTitle and UI components for consistent truncation.
 */
export const SUBTASK_TITLE_MAX_LENGTH = 80;

// Common abbreviations that end with a period but don't end a sentence
const ABBREVIATIONS = /(?:Dr|Mr|Ms|Mrs|Jr|Sr|Prof|St|vs|etc|e\.g|i\.e|a\.m|p\.m|no|vol|dept|est|approx|incl|govt|corp|assn|bros|co|ltd|inc)$/i;

/**
 * Extract a concise title from a subtask description.
 *
 * Strategy:
 * 1. Return '' for empty/undefined input (lets i18n fallback activate in UI)
 * 2. If description fits within maxLength, return as-is
 * 3. Try extracting the first sentence (split on '. ' or ': ' or terminal period),
 *    skipping splits on common abbreviations (Dr., e.g., etc.)
 * 4. If first sentence fits, return it (strip trailing period)
 * 5. Otherwise truncate at last word boundary and append ellipsis
 */
export function extractSubtaskTitle(description: string | undefined | null, maxLength = SUBTASK_TITLE_MAX_LENGTH): string {
  if (!description || !description.trim()) {
    return '';
  }

  const trimmed = description.trim();

  // Try to extract first sentence via '. ', ': ', or period+newline,
  // skipping splits on common abbreviations
  const boundaryPattern = /(?:\.\s|:\s)/g;
  let match: RegExpExecArray | null;
  while ((match = boundaryPattern.exec(trimmed)) !== null) {
    const prefix = trimmed.substring(0, match.index);
    // Skip if the period follows a common abbreviation
    if (match[0].startsWith('.') && ABBREVIATIONS.test(prefix)) {
      continue;
    }
    const sentence = prefix.trim();
    if (sentence.length > 0 && sentence.length <= maxLength) {
      return sentence;
    }
    // First real sentence boundary found but too long - fall through to truncation
    break;
  }

  // Handle single sentence ending with terminal period (strip it if it's the only sentence)
  if (trimmed.endsWith('.') && !trimmed.includes('. ') && !trimmed.includes(':\n') && !trimmed.includes('.\n') && !trimmed.includes(': ')) {
    const withoutPeriod = trimmed.slice(0, -1);
    if (withoutPeriod.length <= maxLength) {
      return withoutPeriod;
    }
    // Continue to truncation logic below if sentence is too long even without period
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  // Truncate at last word boundary within maxLength, ensuring result length doesn't exceed maxLength
  const truncated = trimmed.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  // Reserve space for ellipsis when truncating
  if (lastSpace > 0) {
    return `${trimmed.substring(0, lastSpace)}\u2026`;
  }

  // Fallback for single-word or no-space case: truncate to maxLength-1 + ellipsis
  const cutoff = Math.max(1, maxLength - 1);
  return `${trimmed.substring(0, cutoff)}\u2026`;
}
