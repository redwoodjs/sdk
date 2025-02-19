import React from 'react'
import logo from "app/assets/logo.svg"
import { Avatar, AvatarImage, AvatarFallback } from 'app/components/ui/avatar'
import { link } from 'app/shared/links'

const Header = () => {
  return (
    <header className="py-5 px-page-side h-20 flex justify-between items-center border-b-1 border-border mb-12">
      {/* left side */}
      <div className="flex items-center gap-8">
        <div className="">
          <a href={link("/")} className="flex gap-3 font-display font-bold text-3xl items-center">
            <img src={logo} alt="Apply Wise" className="inline-block pt-5 -mb-3" />
            <span>Apply Wise</span>
          </a></div>
        <nav>
          <ul>
            <li><a href={link("/applications")}>Dashboard</a></li>
          </ul>
        </nav>
      </div>

      {/* right side */}
      <nav>
        <ul className="flex items-center gap-7">
          <li><a href={link("/account/settings")}>Settings</a></li>
          <li><a href={link("/logout")}>Logout</a></li>
          <li>
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </li>
        </ul>
      </nav>
    </header>
  )
}

export { Header }
