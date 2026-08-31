import { Logger } from '@nestjs/common';

// Adapters log on every write; keep the test output about the tests.
// Set JEST_VERBOSE_LOGS=1 to see them when debugging a failure.
if (!process.env.JEST_VERBOSE_LOGS) {
  Logger.overrideLogger(false);
}
