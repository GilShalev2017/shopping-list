import type { PropsWithChildren, ReactElement } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createStore, type AppStore, type PreloadedAppState } from '@/app/store';
import { initI18n } from '@/i18n';
import i18n from '@/i18n';

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: PreloadedAppState;
  store?: AppStore;
  /** Initial router entry, e.g. '/checkout' or '/orders/ord_1'. */
  route?: string;
  /** Router path pattern, needed when the component reads route params. */
  path?: string;
  /** Extra state passed to the router location (used by the confirmation page). */
  routeState?: unknown;
}

export interface RenderWithProvidersResult extends RenderResult {
  store: AppStore;
  user: ReturnType<typeof userEvent.setup>;
}

/**
 * Renders a component inside the full provider stack the app uses: a real (not
 * mocked) Redux store, i18next, and a memory router. Tests therefore exercise
 * the same wiring as production.
 */
export const renderWithProviders = (
  ui: ReactElement,
  {
    preloadedState,
    store = createStore(preloadedState),
    route = '/',
    path,
    routeState,
    ...renderOptions
  }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult => {
  initI18n(store.getState().ui.locale);
  // The i18n instance is a module singleton shared across tests; keep it in
  // step with the store this particular test built.
  void i18n.changeLanguage(store.getState().ui.locale);

  const Wrapper = ({ children }: PropsWithChildren) => (
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[{ pathname: route, state: routeState }]}>
          {path ? (
            <Routes>
              <Route path={path} element={children} />
            </Routes>
          ) : (
            children
          )}
        </MemoryRouter>
      </I18nextProvider>
    </Provider>
  );

  return {
    store,
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
};

export * from '@testing-library/react';
