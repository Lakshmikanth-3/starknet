"use client"

import * as React from "react"
import { useState, useEffect } from "react"

export interface ToastProps {
    id: string;
    title?: string;
    description?: string;
    variant?: "default" | "destructive" | "success";
}

let memoryState: ToastProps[] = [];
let listeners: Function[] = [];

export const toast = (props: Omit<ToastProps, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...props, id };
    memoryState = [...memoryState, newToast];
    listeners.forEach(fn => fn(memoryState));

    setTimeout(() => {
        memoryState = memoryState.filter(t => t.id !== id);
        listeners.forEach(fn => fn(memoryState));
    }, 5000); // auto dismiss
};

export function Toaster() {
    const [toasts, setToasts] = useState<ToastProps[]>([]);

    useEffect(() => {
        listeners.push(setToasts);
        return () => {
            listeners = listeners.filter(fn => fn !== setToasts);
        };
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className={`group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all mb-2
            ${t.variant === 'destructive' ? 'border-red-900 bg-red-950 text-red-50' :
                            t.variant === 'success' ? 'border-green-900 bg-green-950 text-green-50' :
                                'border-zinc-800 bg-zinc-900 text-zinc-100'}
          `}
                >
                    <div className="grid gap-1">
                        {t.title && <div className="text-sm font-semibold">{t.title}</div>}
                        {t.description && <div className="text-sm opacity-90">{t.description}</div>}
                    </div>
                </div>
            ))}
        </div>
    )
}
