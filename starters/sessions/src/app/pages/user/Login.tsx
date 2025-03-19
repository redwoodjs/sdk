"use client";

import { useTransition } from "react";
import { performLogin } from "./functions";

export function Login() {
  const [isPending, startTransition] = useTransition();

  const handlePerformLogin = () => {
    startTransition(() => {
      const doLogin = async () => {
        await performLogin();
        window.location.href = "/";
      };
      doLogin();
    });
  };

  return (
    <>
      <button onClick={handlePerformLogin} disabled={isPending}>
        {isPending ? <>...</> : "Login"}
      </button>
    </>
  );
}
