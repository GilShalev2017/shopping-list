import { vi } from 'vitest';

/**
 * jsdom performs no layout, so every element reports `scrollWidth === 0` and
 * `clientWidth === 0` and nothing ever looks truncated. These helpers stub the
 * two properties on the prototype for the duration of a test so the
 * truncation-detection path can be exercised.
 *
 * `restoreMocks: true` in vite.config.ts undoes the spies after each test.
 */
export const mockTruncation = (truncated: boolean): void => {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(truncated ? 400 : 100);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
};

/** Stubs getBoundingClientRect so the tooltip has real coordinates to position from. */
export const mockTriggerRect = (
  rect: Partial<DOMRect> = { top: 200, left: 100, width: 240, height: 40 },
): void => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
};
