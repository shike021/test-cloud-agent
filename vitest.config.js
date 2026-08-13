import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: [
        'src/js/core/**/*.js',
        'src/js/gomoku/{constants,gomoku-game}.js',
        'src/js/game2048/core/**/*.js',
        'src/js/lianliankan/core/**/*.js',
        'src/js/services/**/*.js',
      ],
      reporter: ['text', 'lcov'],
    },
  },
});
