# Routing

A route matches the path part of a URL to an endpoint. An endpoint is a function that returns a JSX component (A page), or a `Response`. The endpoint function receives the parsed parameters of the path, the context, as well as the `Request`.

## Quickstart

The interface to our router is based off of Remix-Router v7. It is very simplified in that we don't allow nesting or layouts.

```ts

import { defineRoutes, index, route } from 'router.ts'


import { HomePage } from './pages/HomePage'
import { InvoiceListPage } from './pages/InvoiceListPage'
import { InvoiceDetailPage } from './pages/InvoiceDetailPage'


export default defineRoutes([
  // The `index` route matches "/"
  index(HomePage),

  route("invoices", InvoiceListPage),
  // named parameters
  route("invoice/:id", InvoiceDetailPage),

  route('/api/test', function(req) {
    return new Response('hello world')
  })

  // wildcard
  route("assets/*", (req, res) => {
    // find file on filesystem
    // stream file back
    return res.send(filestream, 200)
  })
])
```

## TODO

- Implement lazy loading of routes.

- Type safety. How do we ensure that the params have types? Maybe the route array has some sort of response... Like the type that it returns is a function that returns a thing... That's interesting.

Ok. That seems like a possible way forward. What else to consider?

- Type casting? Should we consider have the ability to cast things via the router? Seems like an overreach to me.
Loaders. Stick with Suspense boundary. I kinda see the benefit of been able to declare this on the component itself... Or near the component.

- Don't hide files. I want to be able to follow the request-response cycle in my own code. What does that mean?
- We should expose the express (or something else) part of the framework. The user should invoke a function to pass the request off to Reloaded

- Do not use "magic exports" to surface functionality of the frameworL: E.g.: Loader or fetchData, etc.

- Can we chain requests, middleware is awesome? is it?
```ts
export function auth(req, res, next) {
  // do some auth handling stuff...
  if (req.headers.authorization !== '') {
    return new Response('auth error', 403)
  }
  next()
}

export const r = router([
  route("invoices", [auth, import("./pages/InvoiceList.tsx")]),
])
```

I personally prefer using an array rather than splatting params, but I don't want to move to far from express.
