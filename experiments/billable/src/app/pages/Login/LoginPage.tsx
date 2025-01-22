"use client";

import { useState } from "react";
import { sendEmail } from "./functions";


export function LoginPage() {
  const [email, setEmail] = useState("peter@redwoodjs.com");

  return (
    <div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button onClick={() => sendEmail(email)}>Send Email</button>
    </div>
  );
}
