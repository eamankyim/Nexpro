import * as React from "react"
import { cn } from "@/lib/utils"

export function Descriptions({ children, className, column = 2, ...props }) {
  return (
    <dl
      className={cn(
        "grid gap-4",
        column === 1 && "grid-cols-1",
        column === 2 && "grid-cols-1 md:grid-cols-2",
        column === 3 && "grid-cols-1 md:grid-cols-3",
        className
      )}
      {...props}
    >
      {children}
    </dl>
  )
}

export function DescriptionItem({ label, children, className, ...props }) {
  return (
    <div className={cn("flex pb-1 -mx-5 px-5", className)} {...props}>
      <dt className="text-sm font-medium text-muted-foreground w-[30%] pr-4">{label}</dt>
      <dd className="text-sm text-foreground w-[70%]">{children}</dd>
    </div>
  )
}
