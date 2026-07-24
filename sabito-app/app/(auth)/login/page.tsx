"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12 pb-16">
      <Logo className="mb-8" />
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 sm:p-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Welcome
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Provide credentials to sign in to your marketer partner account
        </p>

        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
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
            <label htmlFor="password" className="text-sm font-semibold">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                className="pr-12"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <Button type="submit" className="w-full" size="lg">
            Sign in
          </Button>
          {submitted && (
            <p className="text-sm text-center text-muted-foreground">
              Auth API coming soon — account signup is stubbed for v1.
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to Sabito App?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
      <div className="fixed bottom-0 left-0 right-0 h-2 bg-primary" aria-hidden />
    </main>
  );
}
