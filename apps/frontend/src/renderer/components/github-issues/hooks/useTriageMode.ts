import { useState, useEffect, useCallback } from 'react';
import { usePhase4Store } from '../../../stores/github/phase4-store';

const MIN_WIDTH = 1200;

export function useTriageMode() {
  const isEnabled = usePhase4Store((s) => s.triageModeEnabled);
  const setEnabled = usePhase4Store((s) => s.setTriageModeEnabled);
  const [isAvailable, setIsAvailable] = useState(false);

  // ResizeObserver to track viewport width
  useEffect(() => {
    const check = () => {
      const wide = window.innerWidth >= MIN_WIDTH;
      setIsAvailable(wide);
      if (!wide) {
        setEnabled(false);
      }
    };

    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [setEnabled]);

  // Keyboard shortcuts: Ctrl+1/2/3 focus triage panels
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      const panelNumber =
        e.key === '1' ? '1' : e.key === '2' ? '2' : e.key === '3' ? '3' : null;
      if (!panelNumber) return;

      e.preventDefault();
      const panel = document.querySelector<HTMLElement>(
        `[data-triage-panel="${panelNumber}"]`,
      );
      panel?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEnabled]);

  const toggle = useCallback(() => {
    if (!isAvailable) return;
    setEnabled(!isEnabled);
  }, [isAvailable, isEnabled, setEnabled]);

  return { isEnabled, isAvailable, toggle };
}
