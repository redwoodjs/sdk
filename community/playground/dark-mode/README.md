# Dark Mode Playground

This playground demonstrates how to implement dark and light mode themes in your RedwoodSDK application using cookies and server actions.

## Features

- Three theme modes: `dark`, `light`, and `system` (follows system preference)
- Cookie-based persistence of user preference
- Server action to update theme
- Prevents FOUC (Flash of Unstyled Content) with inline script
- Tailwind CSS dark mode support

## Running the dev server

```shell
npm run dev
```

Point your browser to the URL displayed in the terminal (e.g. `http://localhost:5173/`). You should see a dark mode toggle button that cycles through system, light, and dark themes.

## Further Reading

- [Dark Mode Guide](https://docs.rwsdk.com/guides/frontend/dark-mode/)
- [RedwoodSDK Documentation](https://docs.rwsdk.com/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers)

