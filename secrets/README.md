# Local secrets (gitignored)

Put machine-local credentials here. Nothing under `secrets/` is committed except `*.example` and this README.

## xAI API key

1. Copy `xai.local.env.example` to `xai.local.env`.
2. Set `XAI_API_KEY=` to your key.
3. Use for local E2E / scripts / BNLaptop or NovelWriterSite-style runs only.

**GitHub Actions** still uses the repository secret `XAI_API_KEY`. CI does not read this folder. Refresh that secret in GitHub Settings when Actions Grok smoke fails with "Incorrect API key".