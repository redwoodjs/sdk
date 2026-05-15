"use client";

import { useState } from "react";
import { sendWelcomeEmail } from "./actions";

const SendEmail = () => {
  const [message, setMessage] = useState<string>("");

  const handleSubmit = async (formData: FormData) => {
    const { success, error } = await sendWelcomeEmail(formData);
    if (success) {
      setMessage("✅ Email sent successfully");
    } else {
      setMessage("❌ An error occurred");
    }

    // after 5 seconds, clear the message
    setTimeout(() => {
      setMessage("");
    }, 5000);
  };

  return (
    <form action={handleSubmit}>
      <h1>Send me a Welcome Email</h1>
      {message && <p>{message}</p>}
      <div>
        <label htmlFor="email">Email</label>
        <input type="email" name="email" id="email" required />
      </div>
      <div>
        <button type="submit">Welcome Me</button>
      </div>
    </form>
  );
};

export { SendEmail };
