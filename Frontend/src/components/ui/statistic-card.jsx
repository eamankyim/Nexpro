/**
 * @deprecated Use DashboardStatsCard from '../DashboardStatsCard' instead.
 * This component is kept for backward compatibility only.
 */
import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"

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
              "text-xs flex items-center gap-1",
              trend === "up" && "text-green-500",
              trend === "down" && "text-red-500",
              trend === "neutral" && "text-muted-foreground"
            )}
          >
            {trend === "up" && <TrendingUp className="h-3.5 w-3.5 shrink-0" />}
            {trend === "down" && <TrendingDown className="h-3.5 w-3.5 shrink-0" />}
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
