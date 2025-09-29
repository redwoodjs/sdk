"use client";

import {
  startPasskeyRegistration,
  finishPasskeyRegistration,
} from "../functions.js";
import {
  type RegistrationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/server/script";

export function Login() {
  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = formData.get("username") as string;

    if (!username) {
      alert("Please enter a username");
      return;
    }

    const options = await startPasskeyRegistration(username);

    if (!options) {
      alert("User not found or error starting registration");
      return;
    }

    let regResponse: RegistrationResponseJSON;
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      regResponse = await startRegistration(options);
    } catch (err: any) {
      console.error(err);
      alert("Error during registration");
      return;
    }

    const verification = await finishPasskeyRegistration(regResponse);
    if (verification) {
      alert("Registration successful!");
    } else {
      alert("Registration failed");
    }
  };

  return (
    <div>
      <h1>Passkey Demo</h1>
      <form onSubmit={handleRegister}>
        <label>
          Username:
          <input name="username" type="text" />
        </label>
        <button type="submit">Register</button>
      </form>
    </div>
  );
}
