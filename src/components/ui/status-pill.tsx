import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils/cn"

const statusPillVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 uppercase tracking-wide",
  {
    variants: {
      status: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        success: "border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-200",
        warning: "border-transparent bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 border-amber-200",
        danger: "border-transparent bg-red-500/15 text-red-600 hover:bg-red-500/25 border-red-200",
        info: "border-transparent bg-blue-500/15 text-blue-600 hover:bg-blue-500/25 border-blue-200",
        neutral: "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      status: "default",
    },
  }
)

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusPillVariants> {}

function StatusPill({ className, status, ...props }: StatusPillProps) {
  return (
    <div className={cn(statusPillVariants({ status }), className)} {...props} />
  )
}

export { StatusPill, statusPillVariants }
