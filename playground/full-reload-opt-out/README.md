# Full Reload Opt-Out

Demonstrates RedwoodSDK's first-class API for forcing a full browser navigation
instead of a soft RSC navigation.

## Behavior

- `/` → Home page
- `/admin` → Admin page
- `/admin/details` → Admin details page

The client entry uses `shouldIntercept` to force a full reload whenever the
user crosses in or out of `/admin`. It also demonstrates the `data-reload`
attribute on the "Go to Home" link.

## Running

```sh
pnpm dev
```

## Tests

```sh
pnpm test:e2e full-reload-opt-out/__tests__/e2e.test.mts
```
