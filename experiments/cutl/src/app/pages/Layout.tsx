import { User } from "@prisma/client";
import React from "react";
import { link } from "../shared/links";
import LogoImage from "@/assets/logo.png";

function Logo() {
  return (
    // TODO: add a logo
    <img src={LogoImage} alt="Cutable Logo" className="h-[50px]" />
  );
}

function Header({ user }: { user?: User }) {
  return (
    <div className="px-8 py-2 flex justify-center items-center border-b bg-black fixed top-0 left-0 right-0 z-50">
      <a href="/">
        <Logo />
      </a>
      {/* <div className="flex gap-2 text-sm font-semibold">
        {user ? (
          <a href={link("/auth/logout")}>Logout</a>
        ) : (
          <a href={link("/auth/login")}>Not logged in</a>
        )}
      </div> */}
    </div>
  );
}

export function Layout({
  children,
  appContext,
}: {
  children: React.ReactNode;
  appContext: { user?: User };
}) {
  return (
    <div className="min-h-screen bg-white">
      <Header user={appContext?.user} />
      <main className="pt-[66px]">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
