"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12 pb-16">
      <Logo className="mb-8" />
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 sm:p-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Join as marketer
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your Sabito App partner account to browse businesses and apply
        </p>

        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-semibold">
              Full name
            </label>
            <Input id="name" name="name" type="text" placeholder="Ama Mensah" required />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-semibold">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-semibold">
              Phone (optional)
            </label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+233 ..."
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-semibold">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" size="lg">
            Create account
          </Button>
          {submitted && (
            <p className="text-sm text-center text-primary font-medium">
              Thanks — marketer signup is stubbed for v1. ABS auth comes next.
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
      <div className="fixed bottom-0 left-0 right-0 h-2 bg-primary" aria-hidden />
    </main>
  );
}
