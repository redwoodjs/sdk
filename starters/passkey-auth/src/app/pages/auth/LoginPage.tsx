"use client";

import { useState, useTransition } from "react";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import {
  finishPasskeyLogin,
  finishPasskeyRegistration,
  startPasskeyLogin,
  startPasskeyRegistration,
} from "./functions";
import { useTurnstile } from "redwoodsdk/turnstile";

// >>> Replace this with your own Cloudflare Turnstile site key
const TURNSTILE_SITE_KEY = "1x00000000000000000000AA";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState("");
  const [isPending, startTransition] = useTransition();
  const turnstile = useTurnstile(TURNSTILE_SITE_KEY);

  const passkeyLogin = async () => {
    const options = await startPasskeyLogin();
    const login = await startAuthentication({ optionsJSON: options });
    const success = await finishPasskeyLogin(login);

    if (!success) {
      setResult("Login failed");
    } else {
      setResult("Login successful!");
    }
  };

  const passkeyRegister = async () => {
    const options = await startPasskeyRegistration(username);
    const registration = await startRegistration({ optionsJSON: options });
    const turnstileToken = await turnstile.challenge();

    const success = await finishPasskeyRegistration(
      username,
      registration,
      turnstileToken,
    );

    if (!success) {
      setResult("Registration failed");
    } else {
      setResult("Registration successful!");
    }
  };

  const handlePerformPasskeyLogin = () => {
    startTransition(() => void passkeyLogin());
  };

  const handlePerformPasskeyRegister = () => {
    startTransition(() => void passkeyRegister());
  };

  return (
    <>
      <div ref={turnstile.ref} />
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
      />
      <button onClick={handlePerformPasskeyLogin} disabled={isPending}>
        {isPending ? <>...</> : "Login with passkey"}
      </button>
      <button onClick={handlePerformPasskeyRegister} disabled={isPending}>
        {isPending ? <>...</> : "Register with passkey"}
      </button>
      {result && <div>{result}</div>}
    </>
  );
}
