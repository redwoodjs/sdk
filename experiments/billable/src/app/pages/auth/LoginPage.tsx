"use client";

import { RouteOptions } from "@redwoodjs/sdk/router";
import { Loader2 } from "lucide-react";

import { useState, useTransition } from "react";
import { emailLoginLink } from "./functions";
import { Layout } from "../Layout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "../../components/ui/input-otp";
import { link } from "../../shared/links";

export function LoginPage(opts: RouteOptions) {
  const [email, setEmail] = useState("peter@redwoodjs.com");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  const handleSendEmail = () => {
    startTransition(async () => {
      await emailLoginLink(email);
      setSuccess(true);
    });
  };

  return (
    <Layout appContext={opts.appContext}>
      <div className="space-y-2 py-4">
        <h4 className="font-medium leading-none">
          Continue with Email Address
        </h4>
        <p className="text-sm text-muted-foreground">
          You can log in to your account if you already have one, or we will
          create one for you.
        </p>
      </div>

      <div className="grid gap-4 py-4">
        <div className="flex gap-2 max-w-sm">
          {success ? (
            <OTP
              onClick={(token) => {
                const url = new URL(link("/user/auth"), window.location.origin);
                url.searchParams.set("email", email);
                url.searchParams.set("token", token);
                window.location.href = url.toString();
              }}
            />
          ) : (
            <>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
              />
              <Button onClick={handleSendEmail} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Please wait...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

function OTP({ onClick }: { onClick: (token: string) => void }) {
  const [token, setToken] = useState("");

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <InputOTP
          maxLength={6}
          value={token}
          onChange={(value) => setToken(value)}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        <Button onClick={() => onClick(token)} disabled={token.length !== 6}>
          Login
        </Button>
      </div>

      <div className="text-sm pb-4">
        Please enter your one-time password sent to your email.
      </div>
    </div>
  );
}
