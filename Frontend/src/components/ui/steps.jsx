import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function Steps({ current = 0, children, className, ...props }) {
  return (
    <div className={cn("flex items-center gap-6", className)} {...props}>
      {children}
    </div>
  )
}

export function Step({ 
  index, 
  current, 
  completed, 
  title, 
  description,
  onClick,
  className,
  ...props 
}) {
  const isActive = index === current
  const isCompleted = completed || index < current

  return (
    <div
      className={cn(
        "flex items-center",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      {...props}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors",
            isCompleted && "bg-primary border-primary text-primary-foreground",
            isActive && !isCompleted && "border-primary text-primary",
            !isActive && !isCompleted && "border-muted text-muted-foreground"
          )}
        >
          {isCompleted ? (
            <Check className="h-5 w-5" />
          ) : (
            <span className="text-sm font-medium">{index + 1}</span>
          )}
        </div>
        {title && (
          <div className="text-left">
            <div
              className={cn(
                "text-sm font-medium whitespace-nowrap",
                isActive && "text-primary",
                !isActive && "text-muted-foreground"
              )}
            >
              {title}
            </div>
            {description && (
              <div className="text-xs text-muted-foreground mt-1">
                {description}
              </div>
            )}
          </div>
        )}
      </div>
      {index < React.Children.count(props.children?.props?.children) - 1 && (
        <div
          className={cn(
            "h-0.5 w-12 mx-4 flex-shrink-0 transition-colors",
            isCompleted ? "bg-primary" : "bg-muted"
          )}
        />
      )}
    </div>
  )
}
