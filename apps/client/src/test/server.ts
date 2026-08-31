import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Shared MSW server — started once in src/test/setup.ts. */
export const server = setupServer(...handlers);
