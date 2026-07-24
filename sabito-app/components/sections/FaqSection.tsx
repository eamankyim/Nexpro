"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { FAQ_ITEMS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function FaqSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section id="faq" className="bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Got questions? We&apos;ve got answers.
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Everything marketers and businesses need to know about Sabito App,
            commissions, and applying to partner.
          </p>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {FAQ_ITEMS.map((item, index) => {
            const open = openId === item.id;
            return (
              <div key={item.id} className="py-5">
                <button
                  type="button"
                  className="flex w-full items-start gap-4 text-left"
                  onClick={() => setOpenId(open ? null : item.id)}
                  aria-expanded={open}
                >
                  <span className="text-sm font-semibold text-muted-foreground tabular-nums pt-0.5">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 font-semibold text-foreground pr-2">
                    {item.question}
                  </span>
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground",
                      open && "bg-mint text-primary border-primary/30"
                    )}
                  >
                    {open ? (
                      <Minus className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </span>
                </button>
                {open && (
                  <p className="mt-3 pl-10 pr-12 text-sm text-muted-foreground leading-relaxed">
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
