"use client";

import { useState } from "react";
import {
  formAction,
  formRedirectAction,
  onClickAction,
  redirectFromKitchenSink,
} from "../actions";

export function Interactive() {
  const [formResult, setFormResult] = useState("");
  const [onClickResult, setOnClickResult] = useState("");
  const [redirectStatus, setRedirectStatus] = useState("");

  const handleOnClick = async () => {
    const result = await onClickAction();
    setOnClickResult(result);
  };

  const handleRedirect = async () => {
    setRedirectStatus("Redirecting via server action...");
    try {
      await redirectFromKitchenSink();
      // We expect the redirect to happen and navigation to occur,
      // so this text is mostly for cases where redirect is blocked.
    } catch (error) {
      console.error("Redirect action failed", error);
      setRedirectStatus("Redirect failed");
    }
  };

  const formActionWithResult = async (formData: FormData) => {
    const result = await formAction(formData);
    setFormResult(result);
  };

  const handleFormRedirect = async (formData: FormData) => {
    await formRedirectAction(formData);
  };

  return (
    <div>
      <h2>Client Component</h2>

      <div id="form-action-container">
        <h3>Form Action</h3>
        <form action={formActionWithResult}>
          <input type="text" name="text" />
          <button type="submit">Submit</button>
        </form>
        <p data-testid="form-result">{formResult}</p>
      </div>

      <div id="form-redirect-container">
        <h3>Form Redirect Action</h3>
        <p>This form uses a server action that returns a redirect.</p>
        <form action={handleFormRedirect}>
          <button type="submit" data-testid="form-redirect-button">
            Submit for Redirect
          </button>
        </form>
      </div>

      <div id="onclick-action-container">
        <h3>onClick Action</h3>
        <button onClick={handleOnClick} data-testid="onclick-action-button">
          Execute onClick Action
        </button>
        <p data-testid="onclick-result">{onClickResult}</p>
      </div>

      <div id="redirect-action-container">
        <h3>Redirect Action</h3>
        <p>
          This button calls a server action that returns a{" "}
          <code>Response.redirect()</code>. The client detects the redirect
          response and navigates accordingly.
        </p>
        <button onClick={handleRedirect} data-testid="redirect-action-button">
          Trigger Redirect From Server Action
        </button>
        <p data-testid="redirect-status">{redirectStatus}</p>
      </div>
    </div>
  );
}
