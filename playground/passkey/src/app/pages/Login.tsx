import { useState, useTransition } from "react";
import { usePasskey } from "rwsdk/passkey/client";

export function Login() {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState("");
  const [isPending, startTransition] = useTransition();
  const { login, register } = usePasskey();

  const handleRegister = async () => {
    if (!username.trim()) {
      setResult("Please enter a username");
      return;
    }
    try {
      const success = await register(username);
      setResult(success ? "Registration successful!" : "Registration failed");
    } catch (error: unknown) {
      setResult(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    }
  };

  const handleLogin = async () => {
    try {
      const success = await login(username);
      setResult(success ? "Login successful!" : "Login failed");
    } catch (error: unknown) {
      setResult(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    }
  };

  const handlePerformRegister = () => {
    startTransition(() => void handleRegister());
  };

  const handlePerformLogin = () => {
    startTransition(() => void handleLogin());
  };

  return (
    <div>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        disabled={isPending}
      />
      <button onClick={handlePerformLogin} disabled={isPending}>
        {isPending ? "Logging in..." : "Login with Passkey"}
      </button>
      <button onClick={handlePerformRegister} disabled={isPending}>
        {isPending ? "Registering..." : "Register with Passkey"}
      </button>
      {result && <p>{result}</p>}
    </div>
  );
}
