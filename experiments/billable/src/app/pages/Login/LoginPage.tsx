"use client";

import { useState, useTransition } from "react";
import { sendEmail } from "./functions";
import { Layout } from "../Layout";
import type { User } from "@prisma/client";

export function LoginPage({ ctx }: { ctx: { user?: User }   }) {
  const [email, setEmail] = useState('peter@redwoodjs.com');
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  const handleSendEmail = () => {
    startTransition(async () => {
      await sendEmail(email);
      setSuccess(true);
    });
  };

  return (
    <Layout ctx={ctx}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="space-y-12">
          <div className="border-b border-gray-900/10 pb-12">
            <h2 className="text-2xl font-semibold leading-7 text-gray-900">
              Login &amp; Signup
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              You're not currently logged in, please enter your email to receive
              a login link.
            </p>
            <div className="mt-8 flex flex-col items-center space-y-4">
              <div className="flex gap-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full max-w-md rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  placeholder="Enter your email"
                />
                <button
                  onClick={handleSendEmail}
                  disabled={isPending}
                  className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors disabled:bg-gray-400"
                >
                  {isPending ? "Sending..." : "Send"}
                </button>
              </div>
              {success && (
                <p className="text-sm text-green-600">
                  Now, please check your email.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
