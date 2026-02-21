import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean
    variant?: "default" | "outline" | "ghost"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", ...props }, ref) => {
        return (
            <button
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                    "h-9 px-4 py-2",
                    variant === "default" && "bg-btc-500 text-zinc-950 hover:bg-btc-400 font-bold",
                    variant === "outline" && "border border-zinc-800 bg-transparent hover:bg-zinc-800 text-zinc-100",
                    variant === "ghost" && "hover:bg-zinc-800 hover:text-zinc-100",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
