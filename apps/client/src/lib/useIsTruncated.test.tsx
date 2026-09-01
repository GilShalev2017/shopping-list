import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useIsTruncated } from './useIsTruncated';
import { mockTruncation } from '@/test/truncation';

const Probe = ({ text }: { text: string }) => {
  const [ref, isTruncated] = useIsTruncated<HTMLSpanElement>(text);
  return (
    <span ref={ref} data-testid="probe" data-truncated={String(isTruncated)}>
      {text}
    </span>
  );
};

const truncated = () => screen.getByTestId('probe').getAttribute('data-truncated');

describe('useIsTruncated', () => {
  it('reports false when the text fits', () => {
    mockTruncation(false);
    render(<Probe text="Milk" />);
    expect(truncated()).toBe('false');
  });

  it('reports true when the text overflows its box', () => {
    mockTruncation(true);
    render(<Probe text="An extremely long product name that will not fit" />);
    expect(truncated()).toBe('true');
  });

  it('tolerates a one-pixel rounding difference', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(101);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);

    render(<Probe text="Borderline" />);
    expect(truncated()).toBe('false');
  });

  it('re-measures when the text changes', () => {
    mockTruncation(false);
    const { rerender } = render(<Probe text="Milk" />);
    expect(truncated()).toBe('false');

    mockTruncation(true);
    rerender(<Probe text="A much longer name after switching language" />);
    expect(truncated()).toBe('true');
  });

  it('observes the element for resizes and disconnects on unmount', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe;
        unobserve = vi.fn();
        disconnect = disconnect;
      },
    );

    const { unmount } = render(<Probe text="Milk" />);
    expect(observe).toHaveBeenCalledWith(screen.getByTestId('probe'));

    unmount();
    expect(disconnect).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('degrades gracefully where ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    mockTruncation(true);

    expect(() => render(<Probe text="Milk" />)).not.toThrow();
    expect(truncated()).toBe('true');

    vi.unstubAllGlobals();
  });
});
