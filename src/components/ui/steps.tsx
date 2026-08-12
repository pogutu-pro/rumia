import * as React from "react"
import { cn } from "@/lib/utils"

interface StepsProps {
  steps: {
    title: string;
    description?: string;
  }[];
  currentStep: number;
  className?: string;
}

export function Steps({ steps, currentStep, className }: StepsProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {steps.map((step, index) => (
        <div key={index} className={cn("flex items-center gap-4", index < currentStep ? "text-primary" : "text-muted-foreground")}>
           <div className={cn("flex items-center justify-center w-8 h-8 rounded-full border-2", index <= currentStep ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground")}>
             {index + 1}
           </div>
           <div>
             <div className="font-medium">{step.title}</div>
             {step.description && <div className="text-sm text-muted-foreground">{step.description}</div>}
           </div>
        </div>
      ))}
    </div>
  )
}
