import { useState, useEffect } from 'react';
import type { InvestigationData } from '@shared/types/investigation';

export interface UseInvestigationDataResult {
  investigation: InvestigationData | null;
  isLoading: boolean;
  error: Error | null;
}

export function useInvestigationData(taskId: string): UseInvestigationDataResult {
  const [investigation, setInvestigation] = useState<InvestigationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInvestigation() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await window.electronAPI.getInvestigationData(taskId);

        if (!cancelled) {
          if (data.success) {
            setInvestigation(data.data ?? null);
          } else {
            // No investigation data is not an error - just return null
            setInvestigation(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setInvestigation(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadInvestigation();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  return { investigation, isLoading, error };
}
