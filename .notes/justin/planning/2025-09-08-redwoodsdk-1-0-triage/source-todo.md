## Sources

### User To-Do List Items

*Items from Justin's personal to-do list that need triage*

#### Focus
- investigate chakra demo (Discord thread: https://discord.com/channels/679514959968993311/1412270477744934942 - user vince-roy having React2.createContext issues with Chakra UI, similar to Radix issues)
- windows paths fixes for scanner (Windows ESM URL scheme error from Marius Walin's students - works on Mac/Linux, breaks on Windows with 0.2.0+. Related to directive scanner: https://github.com/redwoodjs/sdk/blob/main/docs/architecture/directiveScanningAndResolution.md)

#### Important  
- (empty)

#### Unblock
- (empty)

#### Non-deep
- check use client caching during HMR fixed
- say hi with context in kysely discord (where tho?)
- read https://github.com/redwoodjs/sdk/pull/605#issuecomment-3110066490

#### Maintain
- fix style smoke test flakiness

#### Next
- catch and fix ssr errors causing never ending loading (SAME AS: Dev server hangs from I/O context issues - GitHub #468)
- upgrade react deps
- use latest canary for react in starters
- investigate Marius layout context issue (Context providers in layouts work for SSR but not client-side in dev - double-eval of modules causing provider/consumer mismatch. Discord thread shows workaround but core issue needs fixing)
- rwsdk w/ vitest
- rwsdk/db log for migrations on dev
- Upgrade react to try fix id problem
- fix react/react-compiler import issue
- test out usage with react-compiler
- figure out why not seeing node modules "use client" in redwoodui project and fix
- error and docs for ssr errors
- upgrade to vite 7
- actually finish capbase invite flow
- migration control for rwsdk/db

#### 1.0
- perf checks in CI?
- rwsdk/db used and we're happy with it
- route hmr?
- help messages in errors?
- css in server components?
- unbundle deps
- remove deprecated APIs (e.g. headers)
- there's no APIs we want to still settle? (e.g. client nav integrating with initClient)

#### Document
- document that we dont pass props to client components

#### Backlog
- worker run path
- discuss with Peter:: more seamless client nav api integration
- support css modules with server
- remove need for manual client entry points
- rwsdk/db log for migrations on deploy
- support inlining entry point