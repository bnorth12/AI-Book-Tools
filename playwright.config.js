const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 90 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
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
      testMatch: /novelwriter\.smoke\.spec\.js/,
      timeout: 600 * 1000,         // 10 min per test — real LLM calls
      use: {
        headless: false,            // visible browser for manual monitoring
        baseURL: 'http://localhost:8080',
        screenshot: 'on',
        video: 'on',
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
