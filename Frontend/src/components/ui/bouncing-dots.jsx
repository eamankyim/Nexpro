import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Three bouncing dots loading indicator.
 * Used in buttons and other UI elements when loading.
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional classes for size/color (e.g. text-current)
 * @param {'default'|'sm'} [props.size] - Size variant: default (4px dots) or sm (3px dots)
 */
const BouncingDots = React.forwardRef(({ className, size = "default", ...props }, ref) => {
  const dotSize = size === "sm" ? "w-[3px] h-[3px]" : "w-1 h-1"
  const gap = size === "sm" ? "gap-0.5" : "gap-1"

  return (
    <span
      ref={ref}
      role="status"
      aria-label="Loading"
      className={cn("inline-flex items-center justify-center", gap, className)}
      {...props}
    >
      <span
        className={cn("rounded-full bg-current animate-bounce-dot", dotSize)}
        style={{ animationDelay: "0ms" }}
      />
      <span
        className={cn("rounded-full bg-current animate-bounce-dot", dotSize)}
        style={{ animationDelay: "160ms" }}
      />
      <span
        className={cn("rounded-full bg-current animate-bounce-dot", dotSize)}
        style={{ animationDelay: "320ms" }}
      />
    </span>
  )
})
BouncingDots.displayName = "BouncingDots"

export { BouncingDots }
