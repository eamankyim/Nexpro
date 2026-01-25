import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function StatisticCard({
  title,
  value,
  prefix,
  suffix,
  trend,
  trendValue,
  className,
  ...props
}) {
  return (
    <Card className={cn("", className)} {...props}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {trend && (
          <span
            className={cn(
              "text-xs",
              trend === "up" && "text-green-500",
              trend === "down" && "text-red-500",
              trend === "neutral" && "text-muted-foreground"
            )}
          >
            {trend === "up" && "↑"}
            {trend === "down" && "↓"}
            {trendValue}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {prefix}
          {value}
          {suffix}
        </div>
      </CardContent>
    </Card>
  )
}
