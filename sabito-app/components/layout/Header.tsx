"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="hidden md:flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/businesses" className="hover:text-primary">
              Businesses
            </Link>
            <a href="/#faq" className="hover:text-primary">
              FAQ
            </a>
          </nav>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <Link href="/login">
            <Button variant="outline">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button>Join as marketer</Button>
          </Link>
        </div>

        <button
          type="button"
          className="sm:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="sm:hidden border-t border-border bg-white px-4 py-4 space-y-3">
          <Link
            href="/businesses"
            className="block text-sm font-medium"
            onClick={() => setOpen(false)}
          >
            Businesses
          </Link>
          <a
            href="/#faq"
            className="block text-sm font-medium"
            onClick={() => setOpen(false)}
          >
            FAQ
          </a>
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full">
                Sign in
              </Button>
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)}>
              <Button className="w-full">Join as marketer</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
