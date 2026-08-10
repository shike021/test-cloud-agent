import { defineConfig } from 'vitest/config';

// Declared explicitly so Vitest does not fall back to a configuration file from
// an ancestor directory, which belongs to the unrelated project at the repo root.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
