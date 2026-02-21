// File: frontend/app/audit/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAudit, verifyAudit } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { AuditEvent, AuditVerifyResponse } from '@/types';

const VOYAGER_BASE = 'https://sepolia.voyager.online/tx';

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; classes: string }> = {
        ACCEPTED_ON_L2: {
            label: '● Confirmed',
            classes: 'text-green-400 bg-green-950/30 border-green-800',
        },
        SUCCEEDED: {
            label: '● Confirmed',
            classes: 'text-green-400 bg-green-950/30 border-green-800',
        },
        PENDING: {
            label: '◌ Pending',
            classes: 'text-orange-400 bg-orange-950/30 border-orange-800',
        },
        RECEIVED: {
            label: '◌ Received',
            classes: 'text-orange-400 bg-orange-950/30 border-orange-800',
        },
        REJECTED: {
            label: '✗ Failed',
            classes: 'text-red-400 bg-red-950/30 border-red-800',
        },
    };
    const badge = map[status] ?? map['PENDING'];
    return (
        <span
            className={`font-mono text-xs px-2 py-1 border tracking-wider ${badge.classes}`}
        >
            {badge.label}
        </span>
    );
}

function TxHashCell({ hash }: { hash: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="font-mono text-orange-400 text-xs">
                {hash.slice(0, 10)}...{hash.slice(-6)}
            </span>
            <button
                onClick={() => {
                    navigator.clipboard.writeText(hash);
                    toast({ title: 'Hash copied' });
                }}
                className="text-zinc-600 hover:text-orange-400 transition-colors"
                aria-label="Copy hash"
            >
                ⧉
            </button>
            <a
                href={`${VOYAGER_BASE}/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-600 hover:text-orange-400 transition-colors"
                aria-label="View on Voyager"
            >
                ↗
            </a>
        </div>
    );
}

export default function AuditPage() {
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyResults, setVerifyResults] = useState<AuditVerifyResponse | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);

    const fetchAudit = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getAudit();
            setEvents(data.events);
        } catch {
            toast({ title: 'Failed to load audit log', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleVerify = async () => {
        setIsVerifying(true);
        try {
            const results = await verifyAudit();
            setVerifyResults(results);
            setShowModal(true);
        } catch {
            toast({ title: 'On-chain verification failed', variant: 'destructive' });
        } finally {
            setIsVerifying(false);
        }
    };

    useEffect(() => { fetchAudit(); }, [fetchAudit]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchAudit, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchAudit]);

    return (
        <main className="max-w-6xl mx-auto px-4 py-10 space-y-8 animate-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="space-y-1">
                <div className="text-xs font-mono tracking-widest text-zinc-500 uppercase">
                    — Verification Hub
                </div>
                <h1 className="font-display text-3xl font-black tracking-tight text-white animate-fade-1">
                    Audit Ledger
                </h1>
                <p className="text-zinc-500 font-mono text-xs tracking-wide">
                    On-chain verification of every stored transaction hash
                </p>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={fetchAudit}
                    disabled={isLoading}
                    className="font-mono text-xs tracking-widest uppercase px-5 py-2.5
                     border border-zinc-700 text-zinc-300 hover:border-orange-800
                     hover:text-orange-400 transition-all disabled:opacity-40"
                >
                    {isLoading ? '⟳ Loading...' : '↺ Refresh Ledger'}
                </button>

                <button
                    onClick={handleVerify}
                    disabled={isVerifying}
                    className="font-mono text-xs tracking-widest uppercase px-5 py-2.5
                     border border-orange-800 text-orange-400 
                     hover:bg-orange-950/30 transition-all disabled:opacity-40"
                >
                    {isVerifying ? '⟳ Verifying...' : '◈ Verify On-Chain'}
                </button>

                <label className="flex items-center gap-2 cursor-pointer ml-auto">
                    <span className="font-mono text-xs text-zinc-500 tracking-wider">
                        Auto-refresh 30s
                    </span>
                    <div
                        onClick={() => setAutoRefresh(p => !p)}
                        className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer
              ${autoRefresh ? 'bg-orange-600' : 'bg-zinc-700'}`}
                    >
                        <div
                            className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all
                ${autoRefresh ? 'left-5' : 'left-0.5'}`}
                        />
                    </div>
                </label>
            </div>

            {/* Table */}
            <div className="border border-zinc-800 overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/50">
                            {['#', 'Timestamp', 'Type', 'Amount', 'TX Hash', 'Status'].map(h => (
                                <th
                                    key={h}
                                    className="px-4 py-3 text-left font-mono text-xs 
                             tracking-widest text-zinc-500 uppercase"
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <tr key={i} className="border-b border-zinc-800/50">
                                    {Array.from({ length: 6 }).map((__, j) => (
                                        <td key={j} className="px-4 py-3">
                                            <Skeleton className="h-4 w-full bg-zinc-800" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : events.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-16 text-center">
                                    <div className="text-zinc-600 font-mono text-xs tracking-wide">
                                        No audit events yet.<br />
                                        Make a deposit to generate records.
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            events.map((event, i) => (
                                <tr
                                    key={event.id}
                                    className="border-b border-zinc-800/50 hover:bg-zinc-900/30 
                             transition-colors"
                                >
                                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                                        {i + 1}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                                        {new Date(event.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-zinc-300 
                                 tracking-wider uppercase">
                                        {event.type}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                                        {event.amount} BTC
                                    </td>
                                    <td className="px-4 py-3">
                                        <TxHashCell hash={event.tx_hash} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={event.status} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Verify Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="bg-zinc-950 border border-zinc-800 max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-mono text-orange-400 
                                    tracking-widest text-sm uppercase">
                            ◈ On-Chain Verification Results
                        </DialogTitle>
                    </DialogHeader>

                    {verifyResults && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-1">
                                {[
                                    { label: 'Confirmed', val: verifyResults.verified, color: 'text-green-400' },
                                    { label: 'Pending', val: verifyResults.pending, color: 'text-orange-400' },
                                    { label: 'Failed', val: verifyResults.failed, color: 'text-red-400' },
                                ].map(item => (
                                    <div
                                        key={item.label}
                                        className="bg-zinc-900 border border-zinc-800 p-3 text-center"
                                    >
                                        <div className={`text-2xl font-black ${item.color}`}>
                                            {item.val}
                                        </div>
                                        <div className="text-zinc-500 text-xs mt-1 tracking-wider font-mono">
                                            {item.label}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-1 max-h-56 overflow-y-auto">
                                {verifyResults.results.map((r, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between 
                               bg-zinc-900 border border-zinc-800 px-3 py-2"
                                    >
                                        <span className="font-mono text-zinc-400 text-xs">
                                            {r.tx_hash.slice(0, 12)}...{r.tx_hash.slice(-6)}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={r.status} />
                                            {r.voyager_url && (
                                                <a
                                                    href={r.voyager_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-zinc-600 hover:text-orange-400 
                                     text-xs transition-colors"
                                                >
                                                    ↗
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </main>
    );
}
