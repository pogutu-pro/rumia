"use client"

import * as React from "react"
import { Toaster as SonnerToaster } from "sonner"
import { useTheme } from "next-themes"

export function ToastProvider() {
  const { theme } = useTheme()

  return (
    <SonnerToaster 
      theme={theme as "light" | "dark" | "system"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:p-4 group-[.toaster]:rounded-lg",
          title: "group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:border-l-4 group-[.toaster]:border-green-500",
          error: "group-[.toaster]:border-l-4 group-[.toaster]:border-destructive",
          warning: "group-[.toaster]:border-l-4 group-[.toaster]:border-yellow-500",
        },
      }}
    />
  )
}