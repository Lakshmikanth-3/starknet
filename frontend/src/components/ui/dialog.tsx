"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}

export const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => onOpenChange?.(false)}
            />
            <div className="relative z-50">
                {children}
            </div>
        </div>
    );
};

export const DialogContent = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <div className={cn("bg-zinc-950 border border-zinc-800 p-6 shadow-lg", className)}>
        {children}
    </div>
);

export const DialogHeader = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-6">
        {children}
    </div>
);

export const DialogTitle = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>
        {children}
    </h2>
);
