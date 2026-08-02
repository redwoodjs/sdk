# Full Reload Opt-Out

Demonstrates RedwoodSDK's first-class API for forcing a full browser navigation
instead of a soft RSC navigation.

## Behavior

- `/` → Home page with a light blue stylesheet
- `/admin` → Admin page with a warm amber stylesheet
- `/admin/details` → Admin details page (keeps the amber stylesheet)

The client entry uses `shouldIntercept` to force a full reload whenever the
user crosses in or out of `/admin`. It also demonstrates the `data-reload`
attribute on the "Go to Home" link.

Because the two sections use different Documents with different stylesheets, a
soft navigation across the boundary would leave the wrong stylesheet in place.
The full reload ensures the target Document and its stylesheet are loaded fresh.

## Running

```sh
pnpm dev
```

## Tests

```sh
pnpm test:e2e full-reload-opt-out/__tests__/e2e.test.mts
```
