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
} from "../functions";

export function Login() {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState("");
  const [isPending, startTransition] = useTransition();

  const passkeyLogin = async () => {
    try {
      // 1. Get a challenge from the worker
      const options = await startPasskeyLogin();

      // 2. Ask the browser to sign the challenge
      const login = await startAuthentication({ optionsJSON: options });

      // 3. Give the signed challenge to the worker to finish the login process
      const success = await finishPasskeyLogin(login);

      if (!success) {
        setResult("Login failed");
      } else {
        setResult("Login successful!");
      }
    } catch (error: unknown) {
      setResult(
        `Login error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const passkeyRegister = async () => {
    if (!username.trim()) {
      setResult("Please enter a username");
      return;
    }

    try {
      // 1. Get a challenge from the worker
      const options = await startPasskeyRegistration(username);
      // 2. Ask the browser to sign the challenge
      const registration = await startRegistration({ optionsJSON: options });

      // 3. Give the signed challenge to the worker to finish the registration process
      const success = await finishPasskeyRegistration(username, registration);

      if (!success) {
        setResult("Registration failed");
      } else {
        setResult("Registration successful!");
      }
    } catch (error: unknown) {
      setResult(
        `Registration error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handlePerformPasskeyLogin = () => {
    startTransition(() => void passkeyLogin());
  };

  const handlePerformPasskeyRegister = () => {
    startTransition(() => void passkeyRegister());
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
  };

  return (
    <>
      <input
        type="text"
        value={username}
        onChange={handleUsernameChange}
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
