"use client";

import { useTransition, useState } from 'react';
import { createChallenge } from './functions';
import { client } from '@passwordless-id/webauthn';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [isPending, startTransition] = useTransition();

  const passkeyLogin = async () => {
  }

  const passkeyRegister = async () => {
    const challenge = await createChallenge();
    client.register({
      user: '_',
      challenge,
      discoverable: 'required'
    })
  }

  const handlePerformPasskeyLogin = () => {
    startTransition(() => void passkeyLogin());
  };

  const handlePerformPasskeyRegister = () => {
    startTransition(() => void passkeyRegister());
  };

  console.log('sdfsd')
  return (
    <>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />

      <button onClick={handlePerformPasskeyLogin} disabled={isPending}>
        {isPending ? (
          <>
            ...
          </>
        ) : (
          "Login with passkey"
        )}
      </button>
      <button onClick={handlePerformPasskeyRegister} disabled={isPending}>
        {isPending ? (
          <>
            ...
          </>
        ) : (
          "Register with passkey"
        )}
      </button>
    </>
  );
}