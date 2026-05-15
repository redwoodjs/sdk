# RSC Kitchen Sink Playground

This playground demonstrates various React Server Component features in RedwoodSDK,
including server actions and client-side interactivity.

## Features

- Server and client components rendered together
- Form-based server actions
- Client-side `onClick` server actions
- **Server action redirect**: a server action that returns a `Response.redirect()`
  which is converted to an intermediate format on the server and handled on the
  client to perform a redirect.

## Running the dev server

```shell
npm run dev
```

Point your browser to the URL displayed in the terminal (e.g. `http://localhost:5173/`).

On the home page you can:

- Submit the form to see the form action result
- Click the onClick action button to see a timestamped message
- Click the **Redirect Action** button to trigger a server action redirect to the
  **About** page.
- Submit the **Form Redirect Action** to trigger a form-based server action redirect
  to the **About** page with a query parameter.
