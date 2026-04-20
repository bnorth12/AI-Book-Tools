const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 90 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list', { printSteps: true }], ['html', { open: 'never' }]],
  use: {
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'regression',
      testMatch: /novelwriter\.regression\.spec\.js|herbalbookforge\.regression\.spec\.js/,
    },
    {
      name: 'smoke',
      testMatch: /novelwriter\.smoke\.quick\.spec\.js/,
      timeout: 480 * 1000,         // 8 min per test — endpoint sanity pass
      retries: 1,
      use: {
        headless: false,            // visible browser for manual monitoring
        baseURL: 'http://localhost:8080',
        screenshot: 'on',
        video: 'on',
      },
    },
    {
      name: 'smoke-full',
      testMatch: /novelwriter\.smoke\.spec\.js/,
      timeout: 3600 * 1000,        // 60 min per test — additive end-to-end with real LLM calls
      retries: 1,
      use: {
        headless: false,            // visible browser for manual monitoring
        baseURL: 'http://localhost:8080',
        screenshot: 'on',
        video: 'on',
      },
    },
    {
      name: 'smoke-ui-shell',
      testMatch: /bookeditor\.smoke\.spec\.js|bookdecomposer\.smoke\.spec\.js/,
      timeout: 120 * 1000,
      retries: 0,
      use: {
        headless: true,
        baseURL: 'http://localhost:8080',
      },
    },
  ],
  // Python HTTP server for smoke tests (serves the site at localhost:8080)
  webServer: {
    command: 'python -m http.server 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 15 * 1000,
  },
});
