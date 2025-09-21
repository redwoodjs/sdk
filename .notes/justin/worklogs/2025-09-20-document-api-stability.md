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

## 7. Duplicate Title Fix

**Issue**: Pages with experimental badges were showing duplicate titles (e.g., "Realtime" followed by "Realtime Experimental").

**Root Cause**: Starlight automatically generates an H1 from the frontmatter `title`, and we were adding another H1 with the badge (`# Realtime <Badge>`), creating duplicate headings.

**Solution**: Removed the manual H1 headings and placed the badge as the first element in the content, right after the auto-generated title. This provides clear visual indication without duplication:
- `realtime.mdx`: Removed `# Realtime <Badge>`, kept just `<Badge>` at the top
- `database.mdx`: Removed `# Database (D1) <Badge>`, kept just `<Badge>` at the top  
- `database-do.mdx`: Removed `# Database (Durable Objects) <Badge>`, kept just `<Badge>` at the top

All pages now display correctly with single titles and prominent experimental badges.

## 9. Schema Extension Solution

**Issue**: The `experimental` frontmatter field was not being recognized by Starlight, showing as `undefined` in the custom PageTitle component.

**Root Cause**: Starlight's default `docsSchema()` only includes predefined fields. Custom frontmatter fields need to be explicitly defined in the content schema.

**Solution**: Extended Starlight's schema in `content.config.ts`:
```typescript
schema: docsSchema({
  extend: z.object({
    experimental: z.boolean().optional(),
  }),
}),
```

**Result**: The experimental badges now render correctly on all experimental pages:
- `realtime.mdx`: Shows "Realtime Experimental" 
- `database.mdx`: Shows "Database (D1) Experimental"
- `database-do.mdx`: Shows "Database (Durable Objects) Experimental"
- Non-experimental pages (e.g., routing) correctly show no badges

The component override system is working perfectly, providing a clean, maintainable solution for marking experimental APIs.

## 8. Proper Badge Integration via Component Override

**Issue**: The previous badge placement approaches (frontmatter titles, manual H1s, separate elements) didn't look quite right visually and weren't integrated properly into Starlight's title rendering.

**Solution**: Implemented Starlight's component override system to customize title rendering:

1. **Created custom PageTitle component** (`src/components/PageTitle.astro`):
   - Accesses frontmatter via `Astro.locals.starlightRoute.entry.data`
   - Conditionally renders badge when `experimental: true` is set
   - Maintains proper styling and accessibility (id="_top")

2. **Configured component override** in `astro.config.mjs`:
   - Added `components: { PageTitle: './src/components/PageTitle.astro' }`
   - Overrides Starlight's default title rendering

3. **Updated frontmatter approach**:
   - Added `experimental: true` field to experimental pages
   - Removed manual badge elements from content
   - Clean separation of metadata and content

**Result**: Badges now render seamlessly integrated into the page titles, looking natural and professional without duplication or visual inconsistencies. The approach is maintainable and follows Starlight's recommended patterns.

## 10. Missing Import Fix

**Issue**: `authentication.mdx` was throwing a runtime error: "importedCodeStandardWorker is not defined"

**Root Cause**: The file was using `importedCodeStandardWorker` in a code block but missing the import statement.

**Solution**: Added the missing import:
```typescript
import importedCodeStandardWorker from "../../../../../starters/standard/src/worker.tsx?raw";
```

**Result**: Authentication page now loads successfully without runtime errors.

## 11. Improved Badge Placement for Turnstile

**Issue**: The experimental badge for Turnstile was placed inline with the Cloudflare documentation link, making it less contextually clear.

**Solution**: Moved the experimental badge to a more appropriate location:
- **Removed** badge from inline text: `[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) <Badge...>`
- **Added** badge to section heading: `## Optional: Bot Protection with Turnstile <Badge text="Experimental" type="caution" />`

**Result**: The experimental badge now clearly indicates that the entire Turnstile feature is experimental, rather than just the documentation link.

## 12. Individual API Method Badge Placement

**Issue**: The experimental badge for `renderToStream()` and `renderToString()` was placed on a combined heading, making it unclear which specific methods were experimental.

**Solution**: Moved experimental badges to individual API method signatures:
- **Changed** from: `### renderToStream() and renderToString() <Badge...>`
- **To**: Individual badges on each method:
  - `#### renderToStream(element[, options]): Promise<ReadableStream> <Badge text="Experimental" type="caution" />`
  - `#### renderToString(element[, options]): Promise<string> <Badge text="Experimental" type="caution" />`

**Result**: Each API method is now clearly marked as experimental at the point of reference, providing better granular information to developers.

## 13. Missing Import Fix for Compatibility Page

**Issue**: `compatibility.mdx` was throwing a runtime error: "Expected component Aside to be defined: you likely forgot to import, pass, or provide it."

**Root Cause**: The file was using the `<Aside>` component but missing the import statement.

**Solution**: Added the missing import:
```typescript
import { Aside } from "@astrojs/starlight/components";
```

**Result**: Compatibility page now loads successfully without runtime errors.
