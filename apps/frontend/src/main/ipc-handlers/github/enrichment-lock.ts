/**
 * Promise chain lock for enrichment file operations.
 * Serializes concurrent writes to the same file path to prevent corruption.
 * Adapted from plan-file-utils.ts withPlanLock pattern.
 */

const enrichmentLocks = new Map<string, Promise<void>>();

/**
 * Serialize operations on a specific enrichment file to prevent race conditions.
 * Each operation waits for the previous one to complete before starting.
 */
export async function withEnrichmentLock<T>(
  filePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const currentLock = enrichmentLocks.get(filePath) || Promise.resolve();

  let resolve: () => void = () => {};
  const newLock = new Promise<void>((r) => {
    resolve = r;
  });
  enrichmentLocks.set(filePath, newLock);

  try {
    await currentLock;
    return await operation();
  } finally {
    resolve();
    if (enrichmentLocks.get(filePath) === newLock) {
      enrichmentLocks.delete(filePath);
    }
  }
}
