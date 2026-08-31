import type { Config } from 'jest';

/**
 * Unit / integration test configuration.
 *
 * `collectCoverage` is on by default so that `npm test` always enforces the
 * thresholds below — a green run is therefore also a proof of coverage.
 * `npm run test:watch` disables it again for a fast inner loop.
 */
const config: Config = {
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest.setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/__tests__/**',
    // Composition root only: a `NestFactory.create` wrapper with no branching
    // logic of its own. Everything it configures lives in `src/app.setup.ts`,
    // which *is* covered (see app.setup.spec.ts).
    '!src/main.ts',
  ],
  coverageReporters: ['text-summary', 'text', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 90,
      lines: 90,
      branches: 85,
      functions: 90,
    },
  },
};

export default config;
