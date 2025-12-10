"use client";

import { useState } from "react";
import { formActionWithRedirect, onClickActionWithRedirect } from "../actions";

export function RedirectDemo() {
  const [formError, setFormError] = useState<string | null>(null);

  const handleFormSubmit = async (formData: FormData) => {
    try {
      const result = await formActionWithRedirect(formData);
      if (result?.error) {
        setFormError(result.error);
      }
    } catch (error) {
      if (error instanceof Response) {
        window.location.href = error.headers.get("Location") || "/";
      } else {
        throw error;
      }
    }
  };

  const handleOnClick = async () => {
    try {
      await onClickActionWithRedirect();
    } catch (error) {
      if (error instanceof Response) {
        window.location.href = error.headers.get("Location") || "/";
      } else {
        throw error;
      }
    }
  };

  return (
    <div>
      <h2>Redirect in Actions Demo</h2>

      <div>
        <h3>Form Action Redirect</h3>
        <form action={handleFormSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Enter your name"
            data-testid="name-input"
          />
          <button type="submit" data-testid="form-submit">
            Submit (will redirect)
          </button>
        </form>
        {formError && <p data-testid="form-error">{formError}</p>}
      </div>

      <div>
        <h3>onClick Action Redirect</h3>
        <button
          onClick={handleOnClick}
          data-testid="onclick-redirect-button"
        >
          Click to Redirect
        </button>
      </div>
    </div>
  );
}

