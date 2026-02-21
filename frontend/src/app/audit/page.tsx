"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AuditEvent } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const events = await api.getAuditLogs();
                setLogs(events);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 30000); // 30s auto-refresh as requested
        return () => clearInterval(interval);
    }, []);

    const formatHash = (h: string) => {
        if (!h) return '';
        return `${h.slice(0, 10)}...${h.slice(-8)}`;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">

            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">System Audit Log</h1>
                    <p className="text-zinc-400">Real-time on-chain and off-chain transaction history.</p>
                </div>
                <button
                    onClick={() => {
                        setLoading(true);
                        api.getAuditLogs().then(events => {
                            setLogs(events);
                            setLoading(false);
                        });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition border border-zinc-700 group"
                >
                    <Activity className={cn("h-4 w-4", loading && "animate-pulse")} />
                    Refresh Ledger
                </button>
            </div>

            <Card className="border-zinc-800 bg-zinc-900">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-btc-400" /> Event Ledger</CardTitle>
                    <CardDescription>All Starknet events, commitments, and HTLC claims handled by the Vault.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[180px]">Timestamp</TableHead>
                                <TableHead>Event Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Transaction / Hash</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-4 w-40 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-zinc-500">
                                        No transactions found in the audit log.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id} className="group">
                                        <TableCell className="text-zinc-400">
                                            {new Date(log.timestamp).toLocaleString(undefined, {
                                                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
                                            })}
                                        </TableCell>

                                        <TableCell className="font-medium text-zinc-200 capitalize">
                                            {log.eventType.replace(/_/g, ' ')}
                                        </TableCell>

                                        <TableCell>
                                            <div className={cn(
                                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                                                log.status === 'success' && "bg-green-500/10 text-green-500 border border-green-500/20",
                                                log.status === 'pending' && "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20",
                                                log.status === 'failed' && "bg-red-500/10 text-red-500 border border-red-500/20"
                                            )}>
                                                {log.status}
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            {log.txHash ? (
                                                <a
                                                    href={log.txHash.length > 60 ? `https://sepolia.voyager.online/tx/${log.txHash}` : "#"}
                                                    target="_blank" rel="noreferrer"
                                                    className="inline-flex items-center gap-1 font-mono text-zinc-400 group-hover:text-btc-400 transition"
                                                >
                                                    {formatHash(log.txHash)}
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            ) : (
                                                <span className="text-zinc-600">-</span>
                                            )}
                                        </TableCell>

                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    );
}
