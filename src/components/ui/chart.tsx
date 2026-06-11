import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
  Legend
} from "recharts"

import { cn } from "@/lib/utils"

export function ChartContainer({ children, className, ...props }: any) {
  return (
    <div className={cn("h-[300px] w-full", className)} {...props}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background p-2 shadow-sm">
      <div className="text-sm font-medium text-foreground">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="text-sm" style={{ color: p.fill || p.stroke || 'currentColor' }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

export function ChartLegendContent({ payload }: any) {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {payload.map((item: any, index: number) => (
        <div key={index} className="flex items-center gap-1 text-sm text-foreground">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export const ChartTooltip = Tooltip
export const ChartLegend = Legend
