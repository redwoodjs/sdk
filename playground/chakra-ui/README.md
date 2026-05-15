# Chakra UI Playground - RedwoodSDK

A comprehensive playground showcasing all major Chakra UI components integrated with the RedwoodSDK React Server Components framework.

## Overview

This playground demonstrates the integration of Chakra UI v3 with RedwoodSDK, covering all major component categories:

- **Layout Components** - Box, Flex, Grid, Stack, Wrap, Center, Square, Circle, Container, SimpleGrid, AspectRatio
- **Form Components** - Input, Button, Checkbox, Radio, Select, NumberInput, PinInput, Slider, Switch, Textarea
- **Data Display Components** - Badge, Card, Code, Kbd, List, Stat, Table, Tag, Avatar, Divider
- **Feedback Components** - Alert, Progress, CircularProgress, Spinner, Skeleton, Toast
- **Navigation Components** - Breadcrumb, Link, Stepper, Tabs
- **Overlay Components** - Modal, Drawer, AlertDialog, Popover, Tooltip, Menu
- **Media Components** - Avatar (extended), Icon, Image
- **Typography Components** - Heading, Text, Highlight, Mark, responsive typography

## Features

- ✅ Complete Chakra UI component coverage
- ✅ Server-side rendering with React Server Components
- ✅ Client-side interactivity where needed
- ✅ Responsive design examples
- ✅ Comprehensive end-to-end tests
- ✅ Console error monitoring
- ✅ Proper TypeScript integration

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended)

### Installation

```bash
cd playground/chakra-ui-playground
pnpm install
```

### Development

```bash
pnpm dev
```

Visit `http://localhost:5173` to see the playground in action.

### Testing

Run the end-to-end tests:

```bash
pnpm test
```

### Building

```bash
pnpm build
```

### Deployment

```bash
pnpm release
```

## Architecture

The playground follows RedwoodSDK patterns:

- `src/worker.tsx` - Server-side app definition using `defineApp`
- `src/app/Document.tsx` - HTML shell component
- `src/app/ChakraProvider.tsx` - Client-side Chakra UI provider wrapper
- `src/app/pages/Home.tsx` - Main playground page
- `src/app/components/` - Organized component examples by category

### Key Integration Points

1. **ChakraProvider Wrapper**: Uses `"use client"` directive to enable client-side Chakra UI context
2. **Component Organization**: Each category is in its own file for maintainability
3. **Test Coverage**: Comprehensive data-testid attributes for reliable testing
4. **Error Monitoring**: Console error tracking in tests to ensure clean rendering

## Testing Strategy

The end-to-end tests verify:

- All components render without errors
- Interactive functionality works correctly
- No console errors occur during rendering or interaction
- Responsive behavior functions as expected

## Contributing

When adding new components or examples:

1. Add proper `data-testid` attributes for testing
2. Include both basic and advanced usage examples
3. Update the test file to verify the new components
4. Ensure responsive design considerations
5. Document any framework-specific integration notes

## Framework Integration Notes

- Interactive components require `"use client"` directive
- ChakraProvider must wrap client-side components
- Server components can use Chakra UI for styling but not for state management
- Toast notifications and other client-side features work seamlessly with the framework