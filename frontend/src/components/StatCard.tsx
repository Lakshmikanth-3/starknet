import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    value: string | number | null;
    description?: string;
    icon?: React.ReactNode;
    loading?: boolean;
    statusColor?: "green" | "red" | "yellow";
}

export function StatCard({ title, value, description, icon, loading, statusColor }: StatCardProps) {
    return (
        <Card className="flex flex-col justify-between h-full bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-zinc-400">
                    {title}
                </CardTitle>
                {icon && <div className="text-zinc-500">{icon}</div>}
            </CardHeader>

            <CardContent>
                {loading ? (
                    <Skeleton className="h-8 w-[100px]" />
                ) : (
                    <div className="flex items-center gap-2">
                        {statusColor && (
                            <div
                                className={cn(
                                    "h-3 w-3 rounded-full",
                                    statusColor === "green" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "",
                                    statusColor === "red" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "",
                                    statusColor === "yellow" ? "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" : ""
                                )}
                            />
                        )}
                        <div className="text-2xl font-bold text-zinc-100">{value}</div>
                    </div>
                )}
                {description && (
                    <p className="text-xs text-zinc-500 mt-1">
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
