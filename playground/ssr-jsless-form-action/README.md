# Server function form action without browser JavaScript

This playground covers the failure reported in [issue #1296](https://github.com/redwoodjs/sdk/issues/1296).

The page is rendered on the server and does not load a client script. It passes the `answer` server function directly to React as the form's action:

```tsx
<form action={answer}>
```

React renders this as a normal HTML form. The browser can therefore submit it without JavaScript.

## Run the playground

From the repository root, run:

```shell
pnpm build:sdk
pnpm --filter ssr-jsless-form-action dev
```

Open the URL printed by Vite, usually `http://localhost:5173/`.

1. Start the server, then open the printed URL in a fresh browser tab.
2. Confirm that the first page does not show a status message.
3. Enter `A form answer` in the answer field.
4. Select **Send answer** once.
5. Wait for the browser to finish loading the returned page.
6. Check both the returned page and the terminal running Vite.

The returned page should say **The server function ran with: A form answer**. The terminal should print:

```text
answer called A form answer
```

Before the SDK change, the same submission returned **The form was submitted, but the server function did not run** and the terminal did not print the line above.

If the browser asks whether to submit the form again after a refresh, cancel it. Refreshing a page that came from a POST can repeat the POST. To restart the check from a clean state, stop the Vite server, start it again, and open the URL in a fresh tab.

React's hidden form field is visible in the page source. Its name starts with `$ACTION_ID_`. That field tells RedwoodSDK which server function React wants it to call. RedwoodSDK asks React to decode the field, then runs the matching server function before rendering the returned page.

## Run the automated check

From the repository root, run only the local development-server case:

```shell
RWSDK_SKIP_DEPLOY=1 pnpm test:e2e ssr-jsless-form-action/__tests__/e2e.test.mts
```
