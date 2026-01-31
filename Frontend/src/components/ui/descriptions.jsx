import * as React from "react"
import { cn } from "@/lib/utils"

export function Descriptions({ children, className, column = 1, ...props }) {
  return (
    <dl
      className={cn(
        "divide-y-0",
        column === 1 && "grid-cols-1",
        column === 2 && "grid grid-cols-1 md:grid-cols-2 gap-x-8",
        column === 3 && "grid grid-cols-1 md:grid-cols-3 gap-x-8",
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
    <div 
      className={cn(
        "grid grid-cols-[40%_60%] gap-2 py-2.5 border-b border-border/50 last:border-b-0",
        className
      )} 
      {...props}
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground font-medium flex items-center justify-end text-right break-words min-w-0">{children}</dd>
    </div>
  )
}
