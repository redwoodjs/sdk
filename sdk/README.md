<div align="center" style="margin: 0; padding: 0;">
  <a href="https://rwsdk.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://imagedelivery.net/EBSSfnGYYD9-tGTmYMjDgg/53dbc43a-e481-469a-91fc-40d9c0947d00/public">
      <img alt="RedwoodSDK logo" src="https://imagedelivery.net/EBSSfnGYYD9-tGTmYMjDgg/37162c6c-890c-48e3-790a-48b2b87fcd00/public" height="128">
    </picture>
  </a>

  <h1>A React Framework for <a href="https://www.cloudflare.com/">Cloudflare</a>.</h1>

  <p><b>It begins as a Vite plugin that unlocks SSR, React Server Components, Server Functions, and realtime features.</b></p>

<a href="https://rwsdk.com"><img alt="Redwood Inc. logo" src="https://img.shields.io/badge/MADE%20BY%20Redwood%20Inc.-000000.svg?style=for-the-badge&logo=Redwood&labelColor=000"></a>
<a href="https://docs.rwsdk.com"><img alt="Documentation" src="https://img.shields.io/badge/Documentation-000000.svg?style=for-the-badge&logo=Redwood&labelColor=000"></a>
<a href="https://discord.gg/redwoodjs"><img alt="Join the community on Discord" src="https://img.shields.io/badge/Join%20the%20community-blueviolet.svg?style=for-the-badge&logo=Discord&labelColor=000000&logoWidth=20"></a>
<a href="https://github.com/redwoodjs/sdk/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/redwoodjs/sdk?style=for-the-badge&labelColor=000000"></a>

</div>

---

## ✨ RedwoodSDK

**RedwoodSDK** is the missing React framework for Cloudflare — bringing SSR, React Server Components, Server Functions, and Realtime APIs to the edge with the power of [Vite](https://vitejs.dev/).

It features:

- ⚡️ **Zero-config Vite integration**
- 🔁 **Realtime server functions**
- 🧠 **Smart, composable router with middleware and interruptors**
- 🔥 **Blazing-fast SSR and RSC support**

---

## 📦 Quickstart

Start a new project:

```bash
npx create-rwsdk my-project-name
```

Install dependencies:

```bash
cd my-project-name
pnpm install
```

Run the dev server:

```bash
pnpm dev
```

```bash
VITE v6.2.0  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h + enter to show help
```

That's it, your RedwoodSDK is up and running!

### Add more routes?

As long as you return a valid Response, RedwoodSDK is happy!

```js
// worker.tsx

import { defineApp } from "rwsdk/worker";
import { route, render } from "rwsdk/router";
import MyReactPage from "@app/pages/MyReactPage";

export default defineApp([
  render(Document, [
    route("/", () => new Response("Hello, World!")),
    route("/ping", function () {
      return <h1>Pong!</h1>;
    }),
    route("/react", MyReactPage)
    route("/docs", async () => {
      return new Response(null, {
        status: 301,
        headers: {
          "Location": "https://docs.rwsdk.com",
        },
      });
    }),
    route("/sitemap.xml", async () => {
      return new Response(sitemap, {
        status: 200,
        headers: {
          "Content-Type": "application/xml",
        },
      });
    }),
    route("/robots.txt", async () => {
      const robotsTxt = `User-agent: *
        Allow: /
        Disallow: /search
        Sitemap: https://rwsdk.com/sitemap.xml`;

      return new Response(robotsTxt, {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }),
  ]),
]);
```

Start building immediately → [Quick start guide](https://docs.rwsdk.com/getting-started/quick-start/)

---

## React Server Components

RedwoodSDK is true Javascript full-stack:

```js
// users.ts (server function)
"use server";
import { db } from "@/db";

export async function getUsers() {
  const users = await db.users.findAll();
  return users;
}

// UserList.tsx (React server component)
import { getUsers } from "./users";

export default async function UsersPage() {
  const users = await getUsers();
  return (
    <div>
      <ul>
        {users.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

Setup a database now → [React Server Components](https://docs.rwsdk.com/core/react-server-components/)

---

## ⭐️ Like it? Star it!

If this project saves you time or sparks ideas, please [⭐ star the repo](https://github.com/redwoodjs/sdk) — it really helps us grow the community.

---

## 🛠 Contributing

This is a monorepo. To contribute or explore packages:

- Fix bugs or propose features
- Join our community on [Discord](https://discord.gg/redwoodjs)
