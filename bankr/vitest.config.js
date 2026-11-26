import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.{js,ts}'], exclude: ['test/**/*.live.test.js'] },
});
