import * as React from "react"
import { cn } from "@/lib/utils"

const Empty = React.forwardRef(({ 
  className, 
  description = "No data",
  image,
  imageStyle,
  ...props 
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4",
        className
      )}
      {...props}
    >
      {image && (
        <div 
          className="mb-4"
          style={imageStyle}
        >
          {image}
        </div>
      )}
      {description && (
        <p className="text-sm text-muted-foreground text-center">
          {description}
        </p>
      )}
    </div>
  )
})
Empty.displayName = "Empty"

export { Empty }
