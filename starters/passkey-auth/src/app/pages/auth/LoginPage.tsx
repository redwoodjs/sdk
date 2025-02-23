"use client";

import { useTransition, useState } from 'react';
import { startPasskeyLogin } from './functions';
import { client } from '@passwordless-id/webauthn';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [isPending, startTransition] = useTransition();

  const handlePerformPasskeyLogin = () => {
    const loginWithPasskey = async () => {
      const challenge = await startPasskeyLogin();

      console.log('### authenticate', challenge)
      try {
        const authentication = await client.authenticate({
          challenge,
        })
        console.log('###', authentication)
      } catch (error) {
        console.error('###', error)
      }
    }

    startTransition(() => {
      const doPasskeyLogin = async () => {
        await loginWithPasskey();
      }

      doPasskeyLogin();
    });
  };

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
    </>
  );
}