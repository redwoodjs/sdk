"use server";

import { requestInfo } from "rwsdk/worker";

export async function setTheme(theme: "dark" | "light" | "system") {
  requestInfo.response.headers.set(
    "Set-Cookie",
    `theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`,
  );
}

