# Image Optimization

Demonstrates responsive image optimization using Cloudflare Image Transformations and a custom `<Image>` component.

## What's Included

- **`/_image/*` transform route** — A worker route that reads `?w=` and `?q=` query params and fetches the underlying static file with `cf.image` options (width, quality, format auto-negotiation, scale-down fit).
- **`<Image>` component** (`src/app/components/Image.tsx`) — A responsive React component that generates `srcSet` entries across common device widths, supports `fill` mode, `priority` loading, and an `unoptimized` escape hatch for SVGs.
- **Usage examples** (`src/app/pages/Home.tsx`) — Hero image with priority, card thumbnail with responsive sizes, fill-mode banner, and unoptimized SVG.

## Running the dev server

```shell
pnpm dev
```

Point your browser to the URL displayed in the terminal (e.g. `http://localhost:5173/`).

## Further Reading

- [RedwoodSDK Documentation](https://docs.rwsdk.com/)
- [Cloudflare Image Transformations](https://developers.cloudflare.com/images/transform-images/)
