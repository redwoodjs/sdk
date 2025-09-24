"use client";

import { useState } from "react";
import { formAction, onClickAction } from "../actions";

export function Interactive() {
  const [formResult, setFormResult] = useState("");
  const [onClickResult, setOnClickResult] = useState("");

  const handleOnClick = async () => {
    const result = await onClickAction();
    setOnClickResult(result);
  };

  const formActionWithResult = async (formData: FormData) => {
    const result = await formAction(formData);
    setFormResult(result);
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

      <div id="onclick-action-container">
        <h3>onClick Action</h3>
        <button onClick={handleOnClick} data-testid="onclick-action-button">
          Execute onClick Action
        </button>
        <p data-testid="onclick-result">{onClickResult}</p>
      </div>
    </div>
  );
}
