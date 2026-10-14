import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SKELETON_DELAY_MS, useDelayedVisible } from './use-presence';

/**
 * Fast work must never show the loading indicator, and slow work still must; locking only one side
 * would let the other regress.
 */

function Probe({ active }: { active: boolean }) {
  const visible = useDelayedVisible(active);
  return <span data-testid="state">{visible ? 'visible' : 'hidden'}</span>;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDelayedVisible shows only when there is something to wait for', () => {
  it('never appears if it finishes before the window', () => {
    const { getByTestId, rerender } = render(<Probe active />);
    expect(getByTestId('state').textContent).toBe('hidden');

    // Loading finishes after the measured real duration (~10ms).
    act(() => {
      vi.advanceTimersByTime(10);
    });
    rerender(<Probe active={false} />);

    // A surviving timer would flip it to visible here.
    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS * 2);
    });
    expect(getByTestId('state').textContent).toBe('hidden');
  });

  it('appears when it runs past the window, so a real wait is still announced', () => {
    const { getByTestId } = render(<Probe active />);

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS - 1);
    });
    expect(getByTestId('state').textContent).toBe('hidden');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(getByTestId('state').textContent).toBe('visible');
  });

  it('waiting again restarts the window, so no earlier display lingers', () => {
    const { getByTestId, rerender } = render(<Probe active />);
    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
    });
    expect(getByTestId('state').textContent).toBe('visible');

    rerender(<Probe active={false} />);
    expect(getByTestId('state').textContent).toBe('hidden');

    rerender(<Probe active />);
    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS - 1);
    });
    expect(getByTestId('state').textContent).toBe('hidden');
  });
});
