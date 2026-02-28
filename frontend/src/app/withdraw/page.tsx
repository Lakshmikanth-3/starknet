"use client";

import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { Contract, CallData, uint256 } from "starknet";
import { Loader2, ArrowUpRight, ArrowRight, ShieldAlert, Cpu } from "lucide-react";

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || "";

export default function WithdrawPage() {
    const { wallet, address } = useWallet();
    const [loading, setLoading] = useState(false);
    const [proofLoading, setProofLoading] = useState(false);

    const [secret, setSecret] = useState("");
    const [nullifier, setNullifier] = useState("");
    const [bitcoinAddress, setBitcoinAddress] = useState("");

    const [proofParams, setProofParams] = useState<any>(null);

    // Fallback dev util - in real life user computes nullifier client side via Poseidon
    const handleInferNullifier = async () => {
        toast({ title: "Dev Tool", description: "In a full client, the Poseidon tree computes this locally.", variant: "default" });
    }

    const handleWithdraw = async () => {
        if (!secret || !nullifier) {
            toast({ title: "Missing Data", description: "Provide secret and nullifier.", variant: "destructive" });
            return;
        }

        if (!bitcoinAddress || !bitcoinAddress.startsWith('tb1')) {
            toast({ 
                title: "Invalid Bitcoin Address", 
                description: "Please enter a valid Signet testnet address (starts with tb1).", 
                variant: "destructive" 
            });
            return;
        }

        setProofLoading(true);
        try {
            toast({
                title: "Generating ZK Proof...",
                description: "This may take 30-60 seconds via Scarb 2.12.2. The relayer will submit the withdrawal automatically.",
                variant: "default"
            });

            // Calls the backend to sequence ZK Proof generation -> Starknet Withdrawal -> Bitcoin Payout
            const res = await api.withdrawCommitment({ 
                secret, 
                nullifier_hash: nullifier,
                bitcoin_address: bitcoinAddress 
            } as any);

            setProofParams({
                nullifier_hash: nullifier,
                proof_data: 'Processed securely via Backend Relayer',
                txHash: res.txHash || 'Unknown',
                bitcoinTxid: res.bitcoinTxid || 'Pending',
                bitcoinAddress: bitcoinAddress
            });

            if (res.bitcoinTxid) {
                toast({ 
                    title: "Withdrawal Complete!", 
                    description: `Bitcoin sent to ${bitcoinAddress.slice(0, 12)}...`, 
                    variant: "success" 
                });
            } else {
                toast({ 
                    title: "Partial Success", 
                    description: res.message || "Starknet withdrawal OK, but Bitcoin payout pending.", 
                    variant: "default" 
                });
            }
        } catch (e: any) {
            toast({ title: "Withdrawal Failed", description: e.response?.data?.error || e.message || "API Error", variant: "destructive" });
        } finally {
            setProofLoading(false);
        }
    };


    return (
        <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">

            <div className="space-y-2 text-center pb-4">
                <h1 className="text-3xl font-bold tracking-tight">Withdraw Bitcoin</h1>
                <p className="text-zinc-400">Burn sBTC and release native Bitcoin</p>
            </div>

            <Card className="border-0 bg-zinc-900 border-zinc-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ArrowUpRight className="h-5 w-5 text-btc-400" /> Prepare Claim</CardTitle>
                    <CardDescription>Enter the secret generated during your deposit to construct the Zero-Knowledge withdrawal proof.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Withdrawal Secret</label>
                            <Input
                                type="text"
                                placeholder="0x..."
                                className="font-mono text-sm text-zinc-300 bg-zinc-900/80 border-zinc-700 h-12 focus-visible:ring-btc-500 focus-visible:border-btc-500 rounded-xl transition-all"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-sm font-medium text-zinc-300">Nullifier Hash</label>
                                <button onClick={handleInferNullifier} className="text-xs text-btc-400 hover:text-btc-300">Auto-derive</button>
                            </div>
                            <Input
                                type="text"
                                placeholder="0x..."
                                className="font-mono text-sm text-zinc-300 bg-zinc-900/80 border-zinc-700 h-12 focus-visible:ring-btc-500 focus-visible:border-btc-500 rounded-xl transition-all"
                                value={nullifier}
                                onChange={(e) => setNullifier(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Bitcoin Withdrawal Address (Signet)</label>
                            <Input
                                type="text"
                                placeholder="tb1q..."
                                className="font-mono text-sm text-zinc-300 bg-zinc-900/80 border-zinc-700 h-12 focus-visible:ring-btc-500 focus-visible:border-btc-500 rounded-xl transition-all"
                                value={bitcoinAddress}
                                onChange={(e) => setBitcoinAddress(e.target.value)}
                            />
                            <p className="text-xs text-zinc-500">Enter your Bitcoin Signet testnet address where you want to receive your BTC.</p>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-800 flex flex-col gap-3">
                        <Button onClick={handleWithdraw} disabled={proofLoading || !!proofParams} className="w-full bg-btc-500 hover:bg-btc-400 text-black font-bold h-12 rounded-xl shadow-[0_0_15px_rgba(246,147,26,0.3)] transition-all">
                            {proofLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {proofParams ? "Withdrawal Complete" : "Generate ZK Proof & Withdraw"}
                        </Button>
                    </div>

                    {proofParams && (
                        <div className="animate-in fade-in space-y-4 pt-4">
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
                                <ShieldAlert className="h-5 w-5 shrink-0" />
                                <p><strong>WITHDRAWAL COMPLETE:</strong> The ZK proof was verified and your MockBTC was burned on Starknet. {proofParams.bitcoinTxid ? 'Bitcoin has been sent to your address!' : 'Bitcoin payout is pending.'}</p>
                            </div>

                            {/* Starknet Transaction */}
                            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 space-y-3">
                                <div className="flex items-center gap-2 text-purple-400 text-xs uppercase tracking-wider font-semibold">
                                    <Cpu className="h-4 w-4" /> Starknet Transaction
                                </div>
                                {proofParams.txHash && (
                                    <>
                                        <div className="font-mono text-xs text-purple-300 break-all bg-zinc-950 p-3 rounded border border-purple-500/10">
                                            {proofParams.txHash}
                                        </div>
                                        <a 
                                            href={`https://sepolia.voyager.online/tx/${proofParams.txHash}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-purple-400 hover:text-purple-300 underline"
                                        >
                                            View on Voyager →
                                        </a>
                                    </>
                                )}
                            </div>

                            {/* Bitcoin Transaction */}
                            {proofParams.bitcoinTxid && proofParams.bitcoinTxid !== 'Pending' && (
                                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 space-y-3">
                                    <div className="flex items-center gap-2 text-orange-400 text-xs uppercase tracking-wider font-semibold">
                                        <ArrowUpRight className="h-4 w-4" /> Bitcoin Payout
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-xs text-orange-300/70">Transaction ID:</div>
                                        <div className="font-mono text-xs text-orange-300 break-all bg-zinc-950 p-3 rounded border border-orange-500/10">
                                            {proofParams.bitcoinTxid}
                                        </div>
                                        <div className="text-xs text-orange-300/70">Sent to:</div>
                                        <div className="font-mono text-xs text-orange-300 break-all bg-zinc-950 p-3 rounded border border-orange-500/10">
                                            {proofParams.bitcoinAddress}
                                        </div>
                                        <a 
                                            href={`https://mempool.space/signet/tx/${proofParams.bitcoinTxid}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-orange-400 hover:text-orange-300 underline"
                                        >
                                            View on Mempool.space →
                                        </a>
                                    </div>
                                </div>
                            )}

                            {(!proofParams.bitcoinTxid || proofParams.bitcoinTxid === 'Pending') && (
                                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
                                    <p>⚠️ <strong>Bitcoin Payout Pending:</strong> Starknet withdrawal succeeded, but Bitcoin sending failed. Please contact support with your withdrawal secret.</p>
                                </div>
                            )}
                        </div>
                    )}

                </CardContent>
            </Card>

        </div>
    );
}
