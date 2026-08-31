import {
  combineReducers,
  configureStore,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { catalogApi } from '@/features/catalog/catalogApi';
import { ordersApi } from '@/features/orders/ordersApi';
import { cartReducer } from '@/features/cart/cartSlice';
import { uiReducer } from '@/features/ui/uiSlice';
import { loadCartState, loadUiState, persistenceMiddleware } from './persistence';

export const rootReducer = combineReducers({
  cart: cartReducer,
  ui: uiReducer,
  [catalogApi.reducerPath]: catalogApi.reducer,
  [ordersApi.reducerPath]: ordersApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export type PreloadedAppState = Partial<RootState>;

export const createStore = (preloadedState?: PreloadedAppState) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        // Persistence runs before the reducers so it always observes the action
        // that caused the change, and reads the *next* state via getState().
        .prepend(persistenceMiddleware.middleware)
        .concat(catalogApi.middleware, ordersApi.middleware),
    devTools: import.meta.env?.MODE !== 'production',
  });

/** The singleton store used by the running app (tests build their own). */
export const store = createStore({
  cart: loadCartState(),
  ui: loadUiState(),
});

setupListeners(store.dispatch);

export type AppStore = ReturnType<typeof createStore>;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  UnknownAction
>;
