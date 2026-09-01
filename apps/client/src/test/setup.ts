import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
});

afterAll(() => {
  server.close();
});

/**
 * jsdom does not implement matchMedia. The default reports "light" so tests are
 * deterministic; individual tests override it to assert the dark-mode branch.
 *
 * This is deliberately a plain function rather than a `vi.fn()`: the suite runs
 * with `restoreMocks: true`, which would strip a spy's implementation after the
 * first test and leave `matchMedia` returning undefined.
 */
const installMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
};

installMatchMedia();

beforeEach(() => {
  // Restore the default for tests that replaced or removed it.
  installMatchMedia();
});

/** jsdom does not implement scrollTo; silence the "not implemented" noise. */
Object.defineProperty(window, 'scrollTo', { writable: true, value: () => {} });

/**
 * jsdom has no ResizeObserver. `useIsTruncated` uses one to re-measure on
 * layout changes; a no-op stub is enough, because jsdom never lays anything out
 * anyway — tests that care about truncation stub the width properties directly
 * (see `mockTruncation` in src/test/truncation.ts).
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
