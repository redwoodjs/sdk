"use client";

import { useState, useTransition } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { generatePasskeyRegistrationOptions } from './functions';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [isPending, startTransition] = useTransition();

  const passkeyLogin = async () => {
  }

  const passkeyRegister = async () => {
    const options = await generatePasskeyRegistrationOptions(username);
    const registration = await startRegistration({ optionsJSON: options });
    console.log('## registration', registration);
  }

  const handlePerformPasskeyLogin = () => {
    startTransition(() => void passkeyLogin());
  };

  const handlePerformPasskeyRegister = () => {
    startTransition(() => void passkeyRegister());
  };

  return (
    <>
      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
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