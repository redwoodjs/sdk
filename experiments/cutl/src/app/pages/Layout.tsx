import { User } from "@prisma/client";
import React from "react";
import { link } from "../shared/links";

function Logo() {
  return (
    // TODO: add a logo
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M12 2L2 22h20L12 2z" />
      <path d="M12 2L2 22h20L12 2z" />
      <path d="M12 2L2 22h20L12 2z" />
      <path d="M12 2L2 22h20L12 2z" />
    </svg>
  );
}

function Header({ user }: { user?: User }) {
  return (
    <div className="px-8 py-4 flex justify-between items-center border-b">
      <a href="/">
        <Logo />
      </a>
      <div className="flex gap-2 text-sm font-semibold">
        {user ? (
          <a href={link("/auth/logout")}>Logout</a>
        ) : (
          <a href={link("/auth/login")}>Not logged in</a>
        )}
      </div>
    </div>
  );
}

export function Layout({
  children,
  ctx,
}: {
  children: React.ReactNode;
  ctx: { user?: User };
}) {
  return (
    <div className="min-h-screen bg-white">
      <Header user={ctx?.user} />

      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
