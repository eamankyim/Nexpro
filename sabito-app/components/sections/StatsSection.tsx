"use client";

import { motion } from "framer-motion";
import { STATS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const colorMap = {
  orange: "text-accent",
  teal: "text-primary",
  rose: "text-rose",
};

export function StatsSection() {
  const items = [STATS.partners, STATS.businesses, STATS.commissions];

  return (
    <section className="bg-mint">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid lg:grid-cols-[1.1fr_1.4fr] gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45 }}
          >
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-primary-dark tracking-tight">
              Trusted by real partners
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md">
              Marketers earning with businesses that turned on Partner Program
              in ABS.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {items.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: 0.08 * index }}
              >
                <p
                  className={cn(
                    "font-display text-3xl sm:text-4xl font-bold tracking-tight",
                    colorMap[item.color]
                  )}
                >
                  {item.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
