## CI

Before reporting any work as done, run agent-ci to validate changes locally, but do not run deploy or other secret-gated workflows unless the required credentials are available.

Run the credentialless local CI workflows:

```bash
AI_AGENT=1 npx @redwoodjs/agent-ci run --workflow .github/workflows/code-quality.yml
AI_AGENT=1 npx @redwoodjs/agent-ci run --workflow .github/workflows/smoke-test.yml
AI_AGENT=1 npx @redwoodjs/agent-ci run --workflow .github/workflows/playground-e2e-tests.yml
```

`playground-e2e-tests.yml` is the dev-only playground workflow. Skip deploy e2e locally by not running `.github/workflows/playground-e2e-deploy-tests.yml` unless Cloudflare credentials are available. Also avoid `--all` for normal local validation because it includes deploy/release/cleanup workflows that require secrets.

If any credentialless local CI workflow fails, fix the issue and re-run it. Do not report work as done until the credentialless local CI workflows pass, or until an external infrastructure issue is clearly recorded as a blocker.
