'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { Button } from "app/components/ui/button";
import { Icon } from "app/components/Icon";
import { createContact } from "app/pages/applications/functions";

export type TFormData = {
  success?: boolean;
  error?: string | null;
  firstName?: string;
  lastName?: string;
  role?: string;
  email?: string;
}

export function ClientForm({ callback }: { callback: () => void }) {

  const handleSubmit = async (prevState: TFormData, formData: FormData) => {
    const result = await createContact(formData);
    console.log({ result })
    console.log("checking");
    callback();
    return result;
  }

  const [state, formAction, isPending] = useActionState(handleSubmit, {
    success: false,
    error: null,
    firstName: "",
    lastName: "",
    role: "",
    email: "",
  } as TFormData);

  return (
    <form action={formAction}>
      {state.success && (
        <p>Contact created successfully</p>
      )}
      {state.error && (
        <p>Error: {state.error}</p>
      )}
      <fieldset disabled={isPending}>
        <div className="field">
          <label htmlFor="firstName">First Name</label>
          <input type="text" id="firstName" name="firstName" />
        </div>
        <div className="field">
          <label htmlFor="lastName">Last Name</label>
          <input type="text" id="lastName" name="lastName" />
        </div>
        <div className="field">
          <label htmlFor="role">Role</label>
          <input type="text" id="role" name="role" />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input type="email" id="email" name="email" />
        </div>
      </fieldset>
      <div className="field">
        <Button variant="default">
          <Icon id="check" size={24} />
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
