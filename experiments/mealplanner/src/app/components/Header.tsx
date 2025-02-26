"use client";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Link, Menu, X } from "lucide-react";
import { User } from "@/worker";
export function Header(user: User) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-black text-white shadow-md">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo / Branding */}
        <Link href="/" className="text-2xl font-bold">
          MealPlanner 🍽️
        </Link>

        {/* Mobile Menu Button */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden">
          {menuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>

        {/* Navigation */}
        <nav className={`lg:flex gap-6 ${menuOpen ? "block" : "hidden"} lg:block`}>
          <Link href="/plan" className="hover:underline">
            Meal Plan
          </Link>
          <Link href="/setup" className="hover:underline">
            Setup
          </Link>
          {user && (
            <Link href="/user/profile" className="hover:underline">
              Profile
            </Link>
          )}
        </nav>

        {/* User Authentication */}
        <div className={`lg:flex items-center ${menuOpen ? "block" : "hidden"} lg:block`}>
          {user ? (
            <div className="flex items-center gap-4">
              <p className="text-sm">Hi, {user.user.username || "User"}!</p>
              <Button onClick={() => window.location.href = "/user/logout"} className="bg-red-500 px-4 py-2">
                Logout
              </Button>
            </div>
          ) : (
            <Link href="/user/login">
              <Button className="bg-green-500 px-4 py-2">Login</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
