import { useState } from "react";
import { greet } from "../actions.js";

export function ServerActionForm() {
  const [message, setMessage] = useState("");

  async function formAction(formData: FormData) {
    const name = formData.get("name") as string;
    const result = await greet(name);
    setMessage(result);
  }

  return (
    <div data-testid="server-action-form">
      <h2>Server Action Form</h2>
      <form action={formAction}>
        <input type="text" name="name" defaultValue="World" />
        <button type="submit">Submit</button>
      </form>
      {message && <p data-testid="message">{message}</p>}
    </div>
  );
}
