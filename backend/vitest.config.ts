import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DEMO_MODE: 'true',
      PROVIDER_MODE: 'mock',
      DATABASE_PROVIDER: 'mock'
    }
  }
});
