## CI

Before reporting any work as done, run agent-ci to validate changes locally:

```bash
AI_AGENT=1 npx @redwoodjs/agent-ci run --all
```

If it fails, fix the issue and re-run. Do not report work as done until it passes.
