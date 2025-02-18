# Quickstart

Note: This will not currently work. We have not yet published the packages. Therefore you must
run this command in the `redwoodjs/reloaded` repo.

<!-- This will eventually become a vite starter -->
```terminal
npx degit redwoodjs/reloaded/starters/minimal my-project
cd my-project

npm install
npm run dev
```

Open http://localhost:8910 where you'll be be greeted by "Hello, world!"

## Routing

The fundemental law of your software is the request/ response cycle. 

```jsx (src/worker.tsx)
import { defineApp } from '@redwoodjs/reloaded/worker'
import { route } from '@redwoodjs/reloaded/router'

defineApp([
    route('/', function({ request }: { request: Request }) {
        return new Response('Hello, world!')
    }
])
```

In this example a request is made to "/" which is matched by the `/` route, passed on to the route function, and a plain/text Response with `Hello, world!` is returned.


### Responding with JSX

The route function can either return a `Response` object or a JSX element. The JSX element is statically rendered (as html) and then hydrated by React's client side. Both Server and Client components are supported. (More on client components later...)

```jsx (src/worker.tsx)
import { defineApp } from '@redwoodjs/reloaded/worker'
import { route } from '@redwoodjs/reloaded/router'

+ function HomePage() {
+   return <div>Hello, world!</div>
+ }

defineApp([
    route('/', function({ request }: { request: Request }) {
-       return new Response('Hello, world!')
+       return HomePage
    }
])
```

### Layouts

You may have noticed that Redwood does not ship with a default template. You'll have to create one yourself, and use the the `layout` function to nest your routes.

```jsx (src/worker.tsx)
import { defineApp } from '@redwoodjs/reloaded/worker'
+ import { route, layout } from '@redwoodjs/reloaded/router'


+ function Document({ children }) {
+   return (
+       <html>
+           <head><title>RedwoodJS</title></head>
+           <body>{children}</body>
+        </html>
+   )
+ }
+

function HomePage() {
  return <div>Hello, world!</div>
}

defineApp([
+   layout(Document, [
        route('/', function({request }: { request: Request }) {
            return HomePage
        },
+   ])
])
```

## Interactivity

Redwood JSX components default to the `"use server"` directive. This means that in order to enable interactivity you must use the `"use client"` directive and you must enable client side React hydration in your default HTML document.

```jsx (src/worker.tsx)
function Document({ children }) {
return (
    <html>
        <head>
+           <title>RedwoodJS</title>
+           <script type="module" src="/src/client.tsx"></script>
+       </head>
        <body>{children}</body>
    </html>
    )
}
```

```jsx (src/client.tsx)
import { initClient } from "@redwoodjs/reloaded/client";

initClient();
```


### Route Matchers

There are three matching strategies that can be mixed and matched: static, parameters (`:`), and wildcards (`*`).

```tsx
    defineApp([
        route('/static/', /* ... */),
        route('/parameter/:paramter1/:paramter1', /* ... */),
        route('/wildcard/*', /* ... */),
        route('/static/:parameter/*', /* ... */)
    ])
```

The parameter and wildcard values are available under the `params` object in the route function.

```tsx
    defineApp([
        route('/static/:parameter1/*', function({ request, params }) {
            console.log(params.parameter1) // named parameters ":"
            console.log(params.$0) // first wildcard value
        })
    ])
```