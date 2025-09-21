# Work Log: 2025-09-20 - Documenting API Stability

## 1. Problem Definition & Goal

The SDK's public APIs lack clear documentation regarding their stability. Users, particularly those considering the SDK for production use, have no way of knowing which features are considered stable and which are experimental and subject to breaking changes. This can lead to user friction and uncertainty.

The goal is to investigate the SDK's public API surface, research best practices for communicating API stability, and implement a clear, maintainable documentation system that explicitly labels features as "Stable" or "Experimental".

## 2. Investigation: Discovering the Public API

The first step was to create a comprehensive list of all public-facing APIs. This was a multi-step process.

### 2.1. `package.json` Exports

I started by analyzing the `exports` map in `sdk/package.json`. This provided the primary, official entry points for the package. I filtered out internal entry points (those prefixed with `__`) to focus on the intended public surface.

### 2.2. Source Code Analysis

I then traced each of these entry points back to their source files in `sdk/src/` to determine exactly what functions, classes, and types were being re-exported. This analysis produced a detailed list of every public API.

## 3. The Solution: A Hybrid Documentation Strategy

After identifying the APIs, the next step was to determine the best way to communicate their stability. The final chosen strategy uses a central page to define stability and inline labels to mark specific experimental APIs.

### 3.1. The Strategy

1.  **A Central "API Stability" Page:** A page at `docs/src/content/docs/stability.mdx` defines what "Stable" and "Experimental" mean. It establishes the rule that all APIs are considered stable by default unless marked with an inline "Experimental" label.
2.  **Inline Labels:** For APIs classified as experimental, a small, inline `<Badge>` component is placed directly next to the API's title in the documentation. This provides clear, in-context warnings without large, intrusive banners.

### 3.2. Implementation Details

- Created `docs/src/content/docs/stability.mdx`.
- Added a link to the new page in the sidebar in `docs/astro.config.mjs`.
- Added experimental labels to the documentation for `renderToString`, `renderToStream`, `initClientNavigation`, and `Turnstile`.

## 4. Final Public API List & Stability Classification

This is the final, revised list of public APIs based on user feedback, along with their stability and documentation status.

| Entrypoint             | API                       | Stability      | Documented?                                         |
| ---------------------- | ------------------------- | -------------- | --------------------------------------------------- |
| **`rwsdk/vite`**       | `redwood()`               | Stable         | Yes                                                 |
| **`rwsdk/worker`**     | `defineApp()`             | Stable         | Yes                                                 |
|                        | `renderToString()`        | **Experimental** | Yes (`core/react-server-components.mdx`)            |
|                        | `renderToStream()`        | **Experimental** | Yes (`core/react-server-components.mdx`)            |
|                        | `registerServerReference` | Internal       | No                                                  |
|                        | `rscActionHandler`        | Internal       | No                                                  |
|                        | `getRequestInfo`          | Internal       | No                                                  |
| **`rwsdk/client`**     | `initClient()`            | Stable         | Yes (`reference/sdk-client.mdx`)                    |
|                        | `initClientNavigation()`  | **Experimental** | Yes (`guides/frontend/client-side-nav.mdx`)         |
|                        | `createServerReference`   | Internal       | No                                                  |
| **`rwsdk/router`**     | (all exports)             | Stable         | Yes (`core/routing.mdx`, `reference/sdk-router.mdx`)|
| **`rwsdk/auth`**       | (all exports)             | Stable         | Yes (`core/authentication.mdx`)                     |
| **`rwsdk/turnstile`**  | (all exports)             | **Experimental** | Yes (`core/authentication.mdx`)                     |
| **`rwsdk/db`**         | (all exports)             | **Experimental** | Yes (`core/database.mdx`, `core/database-do.mdx`)   |
| **`rwsdk/realtime/*`** | (all exports)             | **Experimental** | Yes (`core/realtime.mdx`)                           |
| **`rwsdk/debug`**      | `debug()`                 | **Experimental** | No                                                  |
| **`rwsdk/constants`**  | `IS_DEV`                  | Internal       | No                                                  |

## 5. Badge Rendering Fix

**Issue**: Badges in page titles were rendering as plain text instead of HTML components.

**Root Cause**: JSX components (`<Badge>`) were placed in frontmatter `title` fields, which are YAML metadata and don't support JSX rendering.

**Solution**: Moved badges from frontmatter titles to H1 headings in the content:
- `database.mdx`: `title: Database (D1) <Badge...>` → `# Database (D1) <Badge...>`
- `database-do.mdx`: `title: Database (Durable Objects) <Badge...>` → `# Database (Durable Objects) <Badge...>`  
- `realtime.mdx`: `title: Realtime <Badge...>` → `# Realtime <Badge...>`

This allows the badges to render properly as components while maintaining the visual hierarchy.

## 6. MDX Parsing Error Fix

**Issue**: MDX error in `core/react-server-components.mdx` - "Plugin 'Code caption' caused an error in its 'preprocessCode' hook. Error message: Expected a valid non-empty non-negative number[], but got [-1]"

**Root Cause**: Multiple syntax issues in the MDX file:
1. `---` lines inside code blocks (lines 53-56 and 80-82) breaking the MDX parser
2. Missing experimental badges for `renderToStream()` and `renderToString()`
3. Incomplete code block at the end of the file

**Solution**: 
- Moved explanatory text outside of code blocks
- Added experimental badge to the combined `renderToStream()` and `renderToString()` section
- Fixed malformed code block syntax
- Removed stray closing ``` at the end

The page now loads successfully without MDX parsing errors.
