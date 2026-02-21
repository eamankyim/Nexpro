import * as React from "react"
import { cn } from "@/lib/utils"

export function Timeline({ children, className, ...props }) {
  return (
    <div className={cn("relative", className)} {...props}>
      {children}
    </div>
  )
}

export function TimelineItem({ children, className, isLast, ...props }) {
  return (
    <div className={cn("relative flex gap-4 pb-8 last:pb-0", className)} {...props}>
      {/* Connecting line - vertical line from indicator to next item */}
      {!isLast && (
        <div className="absolute left-[5px] top-4 bottom-0 w-[1px] bg-border" />
      )}
      {children}
    </div>
  )
}

export function TimelineIndicator({ className, ...props }) {
  return (
    <div
      className={cn(
        "absolute left-0 top-1 h-3 w-3 rounded-full bg-green-500 border-2 border-white",
        className
      )}
      style={{
        boxShadow: '0 0 0 1px #22c55e'
      }}
      {...props}
    />
  )
}

export function TimelineContent({ children, className, ...props }) {
  return (
    <div className={cn("flex-1 pl-6", className)} {...props}>
      {children}
    </div>
  )
}

export function TimelineTitle({ children, className, ...props }) {
  return (
    <h4 className={cn("font-semibold text-foreground", className)} {...props}>
      {children}
    </h4>
  )
}

export function TimelineDescription({ children, className, ...props }) {
  return (
    <p className={cn("text-sm text-muted-foreground mt-1", className)} {...props}>
      {children}
    </p>
  )
}

export function TimelineTime({ children, className, ...props }) {
  return (
    <span className={cn("text-xs text-muted-foreground", className)} {...props}>
      {children}
    </span>
  )
}
