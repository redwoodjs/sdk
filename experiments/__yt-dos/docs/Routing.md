# Routing

A route matches the path part of a URL to an endpoint. An endpoint is a function that returns a JSX component (A page), or a `Response`. The endpoint function receives the parsed parameters of the path, the context, as well as the `Request`.

## Quickstart

The interface to our router is based off of Remix-Router v7.

```ts

import { defineRoutes, index, route, prefix } from 'router.ts'


import { HomePage } from './pages/HomePage'
import { PageOne } from './pages/PageOne'
import { PageTwo } from './pages/PageTwo'


const router = defineRoutes([
  // matches `/`
  index(HomePage),
  ...prefix('/number', [
    // matches `/number`
    index(function() {
      return new Response('Pick one, two, or anything really...')
    }),
     // static, matches `/number/one`
    route("/one", PageOne),
     // static, matches `/number/two`
    route("/two", PageTwo),
    //  named parameters, matches `/number/${anything}`
    route("/:any", function({ params }) => {
      return new Response(params.any)
    }
  ])

  // wildcard parameters
  route("bucket/*", ({ params }) => {
    // Log out the first wildcard param.
    const object = await env.R2.get(params.$0);
    if (object === null) {
      return new Response("Object Not Found", { status: 404 });
    }
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType as string,
      },
    });
  })
])

router.handle({ request, ctx, env, renderPage })
```


# API Reference

- `defineRoutes`
- `route`
- `index`
- `prefix`


# Links

We also include an interface to generate paths in a typesafe way. This allows you to confidently
refactor your links.

```ts

import { defineLinks } from 'links.ts'


const link = defineLinks([
  '/',
  '/user/auth',
  '/user/login',
  '/user/logout',
  '/invoice/all/',
  '/invoice/:id/'
  '/invoice/:id/upload'
  '/invoice/logos/*'
])


link('/invoice/:id', { id: 1 })


```


## TODO

- Type safety. How do we ensure that the params have types? Maybe the route array has some sort of response... Like the type that it returns is a function that returns a thing... That's interesting.

Ok. That seems like a possible way forward. What else to consider?

- Type casting? Should we consider have the ability to cast things via the router? Seems like an overreach to me.
Loaders. Stick with Suspense boundary. I kinda see the benefit of been able to declare this on the component itself... Or near the component.

- Don't hide files. I want to be able to follow the request-response cycle in my own code. What does that mean?
- We should expose the express (or something else) part of the framework. The user should invoke a function to pass the request off to Redwood SDK

- Do not use "magic exports" to surface functionality of the frameworL: E.g.: Loader or fetchData, etc.
