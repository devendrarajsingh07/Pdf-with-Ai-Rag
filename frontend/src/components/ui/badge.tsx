import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        ready: "border-transparent rounded-md bg-[hsl(var(--success-surface))] text-[hsl(var(--success))] gap-2 px-3 py-1 text-sm font-medium",
        processing: "border-transparent rounded-md bg-[hsl(var(--warning-surface))] text-[hsl(var(--warning))] gap-2 px-3 py-1 text-sm font-medium",
        pending: "border-transparent rounded-md bg-secondary text-muted-foreground gap-2 px-3 py-1 text-sm font-medium",
        failed: "border-transparent rounded-md bg-[hsl(var(--danger-surface))] text-destructive gap-2 px-3 py-1 text-sm font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
