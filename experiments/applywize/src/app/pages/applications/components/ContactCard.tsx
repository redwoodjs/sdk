"use client"

import React, { startTransition } from 'react'
import { deleteContact } from '../functions'
import { Avatar, AvatarFallback, AvatarImage } from 'app/components/ui/avatar'
import { Icon } from 'app/components/Icon'

const ContactCard = ({ id, firstName, lastName, email, role }:
  {
    firstName: string,
    lastName: string,
    email: string,
    id: string,
    role: string
  }) => {
  return (
    <div className="flex items-center gap-4 mb-6 relative group/card">
      <div className="hidden group-hover/card:block pr-10 absolute top-2 -left-[37px]">
        <button
          formAction={() => startTransition(async () => {
            const result = await deleteContact(id)
            if (!result.success) {
              console.error(result.error)
            }
          })}
          role="button"
          className="rounded-full text-white bg-destructive p-1 hover:bg-black hover:text-white">
          <Icon id="close" size={16} />
        </button>
      </div>
      <div>
        <Avatar className="size-10">
          <AvatarImage src="https://github.com/shadcn.png" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{firstName} {lastName}</p>
        <p className="text-sm text-zinc-500">{role}</p>
      </div>
      <div>
        <a href={`mailto:${email}`}><Icon id="mail" size={24} /></a>
      </div>
    </div>

  )
}

export { ContactCard }
