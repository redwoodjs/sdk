---
title: Routing Reference
description: Everything you need to know about Routing...
---

RedwoodSDK's routing functionality is enshrined in the Request/ Response cycle. For each and every request there is an equal and opposite Response. Routes are registered in `defineApp` where an incoming request's URL is matched and passed to a route function which returns a `Response` object.

```jsx src/worker.tsx
import { defineApp } from 'redwood-sdk/worker'
import { route } from 'redwood-sdk/router'

export default defineApp({
    route('/', function() {
        return new Response('Hello, world!')
    })
})
```

## Matchers

There are three methods for matching a Request's URL:
- `/static/`: A one to one match of the URL. A trailing slash is optional, but always applied to the route internally.
- `/params/:p1/:p2/`: A colon (`:`) indicates that you want to match arbitrary segments in a URL. These are named and available via the `params` key in the request function, in this example `params.p1`, and `params.p2`
- `/wildcard/*`: This matches everything after the `/wildcard/` string, including other segments. As an example a request to `/wildcard/uploads/images/avatars/peterp.png` would be make "uploads/images/avatars/peterp.png" available in the `$0` key in `params`.

We do not currently support regex matching strategies.
We do not support type casting.

## Route functions

The route function receives an object that contains:
- `request`: The request object
- `params`: Any parameters that were matched and parsed by the route definition.
- `env`: Access to the CloudFlare environment.
- `ctx`: A mutable object that contains per-request information.
<!-- I don't know if this ctx explination is good enough. -->

A route function can return a Response object, or a JSX component. The JSX component is rendered statically as html and then hydrated on the client side by React. More on this later in this document.

```tsx
import { route } from 'redwood-sdk/router'

route('/', function({ request, params, env }) {
    return new Response('Hello, world!', { status: 200 })
})
```

## Interruptors

RedwoodSDK allows you to register a set of request functions against a single route. Each request function is run in sequence and can interrupt the request flow. An example of where this is helpful is if you want to ensure that a user is correctly authenticated in order to view the final Response.

```tsx
import { defineApp } from 'redwood-sdk/worker'
import { route } from 'redwood-sdk/router'

export default defineApp([
    route('/user/settings', [
        function({ ctx }) {
            if (!ctx.user) {
                // If the user is not authenticated, return a response that redirects them to the login page.
                return new Response('Not authenticated', {
                    status: 401,
                    Location: '/user/login',
                })
            }
        },
        function() {
            return UserSettingsPage
        },
    ])
])
```

## Middleware

Middleware allows you to inspect or interrupt every request and response in your application. Middleware is defined in the `defineApp` function, and run in sequence for every request. You can specify as many middleware functions as desired.

<!-- Can you specify a middleware function at the end... once the response is returned? -->

```tsx src/worker.tsx

export default defineApp([
    async function getUserMiddleware({ request, env, ctx }) {
        const session = getSession({ request, env })
        try {
            const user = await db.user.findFirstOrThrow({
                select: {
                    id: true,
                    email: true
                }
                where: {
                    id: session?.userId
                }
            })
            ctx.user = user
        } catch {
            ctx.user = null
        }
    },
    route('/', function({ ctx }) {
        return new Response(`You are logged in as "${ctx.user.email}"`)
    })
])
```

In this example above we're defining a middleware function `getUserMiddleware` that grabs the user's session information, uses the session's userId to fetch a user, and mutates the `ctx` object.
This object is then available in the subsequent route functions.

## JSX

A route function can return a `Response` object or a JSX component. When returning a JSX component it's rendered as static HTML and then hydrated by React's client side libraries. We support React Server Components by default. If you want interactivity then you must specify the `"use client"` directive.

```tsx (src/worker.tsx)
import { defineApp } from 'redwood-sdk/worker'
import { route } from 'redwood-sdk/router'

function Homepage() {
    return <div>Hello, world! I'm a React Server Component!</div>
}

export default defineApp([
    route('/', function() {
        return HomePage
    })
])
```

If you access the `/` page you'll receive the following html
```html
<div>Hello, world! I'm a React Server Component!</div>
```

You'll notice that there's no, `html`, `head` or `body` tags, and that's because RedwoodSDK wants you to have complete control of your stack. In order to define your own "Root Document" you nest it in a `layout`

```tsx (src/worker.tsx)
import { defineApp } from 'redwood-sdk/worker'
import { route, layout } from 'redwood-sdk/router'

function Document({ children }) {
    return (<html>
        <head>
            <title>RedwoodSDK FTW!</title>
        </head>
        <body>{children}</body>
    </html>)
}

function Homepage() {
    return <div>Hello, world! I'm a React Server Component!</div>
}

export default defineApp([
    layout(Document, [
        route('/', function() {
            return HomePage
        })
    ])
])
```

Now when accessing "/" the HomePage component will be nested in the Document component.

### Interactivity

Your components are rendererd as static html and streamed via the response. In addition to the html when pipe in an RSC payload, which is hydrated by the client side React. In order to achieve this you must first instantiate the client side React, create a new `src/client.tsx` file:

```tsx (src/client.tsx)
import { initClient } from "redwood-sdk/client";

initClient();
```

And import that into your Document:
```tsx (src/worker.tsx)
function Document({ children }) {
    return (<html>
        <head>
            <title>RedwoodSDK FTW!</title>
            <script type="module" src="/src/client.tsx"></script>
        </head>
        <body>{children}</body>
    </html>)
}
```

If you want interactivity, then you must use a `"use client"` directive, by default we assume the `"use server"` directive.

## Helpers

The following helpers improve the development experience of the route:

- `prefix` allows you to prepend a string to an array of routes.
```tsx
prefix('/user', [
    route('/login', LoginPage),
    route('/logout', function() { /*... */}),
    route('/authenticate', function() { /*... */}),
])
```
This is particularly helpful if you want to split your routes into seperate files, and colocate services together.

```tsx
import { userRoutes } from '../services/user/routes.tsx'

export default defineApp([
    prefix('/user', userRoutes)
])
```

- `index` is an alias for `route('/', function() { /* ... */ })`

```tsx
export default defineApp([
    index(HomePage)
])
```



