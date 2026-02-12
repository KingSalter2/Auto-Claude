/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTriageMode } from '../useTriageMode';
import { usePhase4Store } from '../../../../stores/github/phase4-store';

describe('useTriageMode', () => {
  beforeEach(() => {
    usePhase4Store.setState({ triageModeEnabled: false });
  });

  it('returns isAvailable=false when viewport < 1200px', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
    window.dispatchEvent(new Event('resize'));
    const { result } = renderHook(() => useTriageMode());
    expect(result.current.isAvailable).toBe(false);
  });

  it('returns isAvailable=true when viewport >= 1200px', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
    window.dispatchEvent(new Event('resize'));
    const { result } = renderHook(() => useTriageMode());
    expect(result.current.isAvailable).toBe(true);
  });

  it('toggle enables triage mode when available', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
    const { result } = renderHook(() => useTriageMode());
    act(() => result.current.toggle());
    expect(result.current.isEnabled).toBe(true);
  });

  it('does not toggle when isAvailable is false', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    const { result } = renderHook(() => useTriageMode());
    act(() => result.current.toggle());
    expect(result.current.isEnabled).toBe(false);
  });

  it('auto-disables when viewport shrinks below 1200px', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
    const { result } = renderHook(() => useTriageMode());
    act(() => result.current.toggle());
    expect(result.current.isEnabled).toBe(true);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.isAvailable).toBe(false);
  });

  describe('keyboard shortcuts', () => {
    function createPanel(panelNumber: string): HTMLElement {
      const panel = document.createElement('section');
      panel.setAttribute('data-triage-panel', panelNumber);
      panel.tabIndex = -1;
      document.body.appendChild(panel);
      return panel;
    }

    afterEach(() => {
      for (const el of document.querySelectorAll('[data-triage-panel]')) {
        el.remove();
      }
    });

    it('Ctrl+1 focuses issue list panel when triage enabled', () => {
      const panel = createPanel('1');
      const focusSpy = vi.spyOn(panel, 'focus');

      Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
      const { result } = renderHook(() => useTriageMode());
      act(() => result.current.toggle());

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true }),
        );
      });

      expect(focusSpy).toHaveBeenCalled();
    });

    it('Ctrl+2 focuses issue detail panel', () => {
      const panel = createPanel('2');
      const focusSpy = vi.spyOn(panel, 'focus');

      Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
      const { result } = renderHook(() => useTriageMode());
      act(() => result.current.toggle());

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: '2', ctrlKey: true, bubbles: true }),
        );
      });

      expect(focusSpy).toHaveBeenCalled();
    });

    it('Ctrl+3 focuses triage sidebar panel', () => {
      const panel = createPanel('3');
      const focusSpy = vi.spyOn(panel, 'focus');

      Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
      const { result } = renderHook(() => useTriageMode());
      act(() => result.current.toggle());

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: '3', ctrlKey: true, bubbles: true }),
        );
      });

      expect(focusSpy).toHaveBeenCalled();
    });

    it('keyboard shortcuts inactive when triage mode disabled', () => {
      const panel = createPanel('1');
      const focusSpy = vi.spyOn(panel, 'focus');

      Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
      renderHook(() => useTriageMode());

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true }),
        );
      });

      expect(focusSpy).not.toHaveBeenCalled();
    });
  });
});
