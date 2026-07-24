"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-mint via-white to-mint-deep/40">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(15,118,110,0.12), transparent 40%), radial-gradient(circle at 80% 10%, rgba(249,115,22,0.1), transparent 35%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-14 sm:pb-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="text-left"
          >
            <p className="font-display text-sm font-semibold uppercase tracking-wider text-primary mb-3">
              Sabito App
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-bold leading-[1.1] tracking-tight text-primary-dark">
              Want to earn?{" "}
              <span className="text-accent">We&apos;ve got partners.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Browse businesses that pay commission, apply to partner, and grow
              with shops, studios, and pharmacies on African Business Suite.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button size="lg">Join as marketer</Button>
              </Link>
              <Link href="/businesses">
                <Button size="lg" variant="outline">
                  Browse businesses
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Own a business? Enable Partner Program in{" "}
              <a
                href="https://africanbusinesssuite.com"
                className="text-primary font-medium hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                ABS
              </a>{" "}
              to appear here.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12 }}
            className="relative mx-auto w-full max-w-sm"
          >
            <div className="animate-float relative mx-auto w-[260px] sm:w-[280px] rounded-[2rem] border-[10px] border-slate-800 bg-slate-900 p-3">
              <div className="rounded-[1.35rem] overflow-hidden bg-mint min-h-[460px] p-4">
                <div className="rounded-full bg-white border border-border px-3 py-2 text-xs text-muted-foreground mb-4">
                  Partners near me
                </div>
                <div className="rounded-2xl border border-border bg-white p-3 mb-3">
                  <p className="text-[10px] text-muted-foreground mb-1">Reminder</p>
                  <p className="text-xs font-semibold text-foreground">
                    New partner application received
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">1 min ago</p>
                </div>
                <div className="rounded-2xl border border-border bg-white overflow-hidden">
                  <div className="h-28 bg-gradient-to-br from-primary/20 to-accent/20" />
                  <div className="p-3">
                    <p className="text-xs font-semibold">Helena Prints</p>
                    <p className="text-[10px] text-muted-foreground">
                      Commission from 8%
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -left-2 top-24 rounded-2xl border border-border bg-white px-3 py-2 text-xs">
              <span className="text-accent font-bold">★ 5.0</span>
              <span className="text-muted-foreground ml-2">Trusted partners</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
