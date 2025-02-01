import { User } from "@prisma/client";
import React from "react";
import { link } from "../shared/links";
import { Logo } from "./Logo";

function Header({ user }: { user?: User }) {
  return (
    <div className="p-4 flex justify-between">
      <div>
        <h1 className="text-2xl font-bold">
          <a href="/"><Logo /></a>
        </h1>
      </div>
      <div>
        {user ? (
          <a href={link("/invoice/list")}>{user.email}</a>
        ) : (
          <a href={link("/user/login")}>Not logged in</a>
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
