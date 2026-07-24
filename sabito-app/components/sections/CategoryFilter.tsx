"use client";

import { cn } from "@/lib/utils";
import { CATEGORIES, type BusinessCategory } from "@/lib/mock-data";

export function CategoryFilter({
  active,
  onChange,
}: {
  active: BusinessCategory;
  onChange: (category: BusinessCategory) => void;
}) {
  return (
    <div className="border-b border-border bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6 overflow-x-auto py-4 scrollbar-none">
          {CATEGORIES.map((category) => {
            const isActive = category === active;
            return (
              <button
                key={category}
                type="button"
                onClick={() => onChange(category)}
                className={cn(
                  "whitespace-nowrap text-sm pb-2 border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
