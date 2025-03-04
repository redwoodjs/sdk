"use client"

import React, { useActionState } from 'react'
import { User } from '@prisma/client'
import { Button } from 'app/components/ui/button'
import { updateUser } from '../functions'

// TODO: form validation with Zod
export interface TSettingsFormData {
  success?: boolean;
  error?: string | null;
  name?: string;
  username?: string;
  email?: string;
}

const SettingsForm = ({ user }: { user: User }) => {

  const handleSubmit = async (prevState: TSettingsFormData, formData: FormData): Promise<TSettingsFormData> => {
    const data = {
      name: formData.get('name') as string,
      username: formData.get('username') as string,
      email: formData.get('email') as string,
    }

    const result = await updateUser(data)

    return { ...prevState, ...result }
  }

  const [state, formAction, isPending] = useActionState(handleSubmit, {
    success: false,
    error: null,
    name: user.name,
    username: user.username,
    email: user.email,
  } as TSettingsFormData);

  return (
    <form action={formAction}>
      <fieldset>
        <div className="grid grid-cols-2 gap-[200px] px-page-side mb-[75px]">
          <div>
            <h2>Account Information</h2>
            <div className="field">
              <label htmlFor="name">Full Name</label>
              <input type="text" id="name" name="name" defaultValue={state.name} required />
            </div>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input type="text" id="username" name="username" defaultValue={state.username} required />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" name="email" defaultValue={state.email} required />
            </div>
            <div className="field">
              <Button>Update</Button>
            </div>
          </div>
        </div>
      </fieldset>
    </form>
  )
}

export { SettingsForm }
