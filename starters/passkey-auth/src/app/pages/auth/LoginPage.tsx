"use client";

import { useTransition, useState } from 'react';
import { startPasskeyLogin } from './functions';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [isPending, startTransition] = useTransition();

  const handlePerformPasskeyLogin = () => {
    startTransition(() => {
      const doPasskeyLogin = async () => {
        await startPasskeyLogin(email);
        window.location.href = "/";
      }
      doPasskeyLogin();
    });
  };

  return (
    <>
      <button onClick={handlePerformPasskeyLogin} disabled={isPending}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
       
        {isPending ? (
          <>
            ...
          </>
        ) : (
          "Login with passkey"
        )}
      </button>
    </>
  );
}