import { User } from "@prisma/client";
import React from "react";

export function Layout({ children, ctx }: { children: React.ReactNode, ctx: { user?: User } }) {
  if (typeof ctx === "undefined") {
    throw new Error("ctx is not defined");
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-gray-900"><a href="/">Billable</a></span>
            </div>
            <div className="flex items-center">
              {ctx?.user ? (
                <span className="text-sm font-medium text-gray-900"><a href="/invoices">{ctx.user.email}</a></span>
              ) : (
                <span className="text-sm font-medium text-gray-900"><a href="/login">Not logged in</a></span>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
