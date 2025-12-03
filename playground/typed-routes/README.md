# Typed Routes Playground

This playground demonstrates and tests the typed routes functionality with `linkFor` that automatically infers routes from the app definition.

## Features Tested

- Static routes (e.g., `/`)
- Routes with named parameters (e.g., `/users/:id`)
- Routes with wildcards (e.g., `/files/*`)
- Type-safe link generation with automatic route inference
- Parameter validation at compile-time and runtime

## Running the dev server

```shell
npm run dev
```

Point your browser to the URL displayed in the terminal (e.g. `http://localhost:5173/`).

## Testing

```shell
pnpm tsc --noEmit
```
