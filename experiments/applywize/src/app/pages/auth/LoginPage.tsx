"use client";

import { AuthLayout } from "app/layouts/AuthLayout";
import { link } from "app/shared/links";
import { useState, useTransition } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { finishPasskeyLogin, finishPasskeyRegistration, startPasskeyLogin, startPasskeyRegistration } from './functions';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [result, setResult] = useState('');
  const [isPending, startTransition] = useTransition();

  const passkeyLogin = async () => {
    const options = await startPasskeyLogin();
    const login = await startAuthentication({ optionsJSON: options });
    const success = await finishPasskeyLogin(login);

    if (!success) {
      setResult('Login failed');
    } else {
      setResult('Login successful!');
      // redirect te user
      window.location.href = link('/applications');
    }
  }

  const passkeyRegister = async () => {
    const options = await startPasskeyRegistration(username);
    const registration = await startRegistration({ optionsJSON: options });
    const success = await finishPasskeyRegistration({ username, registration });

    if (!success) {
      setResult('Registration failed');
    } else {
      console.log('Registration successful');
      // redirect te user
      window.location.href = link('/applications');
    }
  }

  const handlePerformPasskeyLogin = () => {
    startTransition(() => void passkeyLogin());
  };

  const handlePerformPasskeyRegister = () => {
    startTransition(() => void passkeyRegister());
  };


  return (
    <AuthLayout>
      <div className="relative h-full min-h-[calc(100vh_-_96px)] w-full center">
        <div className="absolute top-0 right-0 p-10">
          <a href={link('/signup')} className="font-display font-bold text-black text-sm border-b-1 border-black hover:border-primary">
            Register
          </a>
        </div>

        <div>
          <form className="max-w-[400px] login-form">
            <h1 className="page-title text-center">Login</h1>
            <p className="text-center text-zinc-500 text-sm py-6">Enter your username below to sign-in.</p>
            <p>{result && <span>{result}</span>}</p>

            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
            <button className="primary mb-6" onClick={handlePerformPasskeyLogin} disabled={isPending}>
              Login with Passkey
            </button>

            <p>By clicking continue, you agree to our <a href={link('/terms')}>Terms of Service</a> and <a href={link('/privacy')}>Privacy Policy</a>.</p>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
}
