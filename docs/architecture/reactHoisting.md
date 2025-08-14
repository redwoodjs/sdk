# Architecture: React's Hoisting Behavior for `<link>`

A critical aspect of our server-side rendering strategy relies on a feature of React 19. As documented in the [official React documentation](https://react.dev/reference/react-dom/components/link#special-rendering-behavior), React will automatically hoist `<link>` components into the document's `<head>`, regardless of where they are rendered in the React tree.

> React will always place the DOM element corresponding to the `<link>` component within the document’s `<head>`, regardless of where in the React tree it is rendered. The `<head>` is the only valid place for `<link>` to exist within the DOM, yet it’s convenient and keeps things composable if a component representing a specific page can render `<link>` components itself.

This behavior is fundamental to our asset-handling strategy. It makes components like `<Preloads>` and `<Stylesheets>` possible. We can render them deep within our application tree, after the full list of dependencies for a given request is known, and trust that React will place the resulting `<link>` tags in the correct location (`<head>`). This allows the browser to act on these resource hints immediately, enabling us to preload scripts and stylesheets effectively without compromising our streaming server-rendering architecture.
