"use client"

import React from 'react'
import { User } from '@prisma/client'
import { Button } from 'app/components/ui/button'

// TODO: form validation with Zod
export interface TSettingsFormData {
  success?: boolean;
  error?: string | null;
  name?: string;
}

const SettingsForm = ({ user }: { user: User }) => {
  return (
    <form>
      <fieldset>
        <div className="grid grid-cols-2 gap-[200px] px-page-side mb-[75px]">
          <div>
            <h2>Account Information</h2>
            <div className="field">
              <label htmlFor="name">Full Name</label>
              <input type="text" id="name" name="name" defaultValue={user.name} required />
            </div>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input type="text" id="username" name="username" defaultValue={user.username} required />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" name="email" defaultValue={user.email} required />
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
