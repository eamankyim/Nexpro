import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { BouncingDots } from "@/components/ui/bouncing-dots"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        /** White background with border (stroke). Use for secondary actions e.g. Refresh, Filter, Cancel, View. */
        secondaryStroke:
          "border border-input bg-background text-foreground hover:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 min-h-[44px] md:min-h-[40px]",
        sm: "h-9 rounded-md px-3 min-h-[44px] md:min-h-[36px]",
        lg: "h-11 rounded-md px-8 min-h-[48px]",
        icon: "p-1 shrink-0 [&>svg]:h-6 [&>svg]:w-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  const isDisabled = disabled || loading
  const isIconOnly = size === "icon"

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading ? "true" : undefined}
      aria-disabled={loading ? "true" : undefined}
      {...props}
    >
      {loading && !asChild ? (
        <BouncingDots size={isIconOnly ? "sm" : "default"} className="text-current" />
      ) : (
        children
      )}
    </Comp>
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
