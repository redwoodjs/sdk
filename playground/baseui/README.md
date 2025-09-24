# Base UI Showcase

A comprehensive demonstration of Base UI components integrated with RedwoodSDK's React server component framework.

## Overview

This playground showcases all available Base UI components with proper server-side rendering support and comprehensive end-to-end testing. It demonstrates how to integrate Base UI's headless component library with RedwoodSDK's framework.

## Components Covered

This showcase demonstrates the integration of Base UI components with RedwoodSDK's server-side rendering:

### Successfully Integrated Components
- **Accordion** - Collapsible content sections with state management
- **Dialog** - Modal dialog windows with portal rendering
- **Alert Dialog** - Confirmation dialogs with proper backdrop
- **Avatar** - User profile images with fallback support
- **Input & Field** - Text input with label and description
- **Switch** - Toggle switches with visual state feedback
- **Toggle** - Press/unpress button states
- **Tabs** - Tabbed interface with content switching
- **Popover** - Contextual popup content with positioning
- **Tooltip** - Hover information displays

### Architecture Pattern
The implementation uses a hybrid SSR + client hydration approach:

1. **Server-Side Rendering**: Static content renders on the server for fast initial page load
2. **Client Hydration**: Interactive Base UI components load after hydration using React.lazy()
3. **Progressive Enhancement**: Page is functional with SSR, enhanced with interactivity
4. **Portal Support**: Proper CSS isolation for popup components (dialogs, popovers, tooltips)

## Features

- **Server-Side Rendering** - All components render on the server
- **Portal Support** - Proper portal configuration for overlays
- **Accessibility** - Base UI's built-in accessibility features
- **Type Safety** - Full TypeScript support
- **Comprehensive Testing** - End-to-end tests for all components

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Testing

The playground includes comprehensive end-to-end tests that:

1. Verify each component renders without console errors
2. Test component interactions (clicks, hovers, form inputs)
3. Validate portal-based components (dialogs, popovers, tooltips)
4. Ensure proper server-side rendering compatibility

## Architecture

- **Framework**: RedwoodSDK with React Server Components
- **UI Library**: Base UI (@base-ui-components/react)
- **Styling**: CSS with utility classes
- **Testing**: Vitest with Playwright for e2e tests
- **Deployment**: Cloudflare Workers

## Portal Configuration

Base UI components that use portals (Dialog, Popover, Tooltip, etc.) require proper CSS isolation:

```css
.root {
  isolation: isolate;
}
```

This ensures popup components render above all other content without z-index conflicts.
