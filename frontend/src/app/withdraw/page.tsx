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

    const [proofParams, setProofParams] = useState<any>(null);
    const [isSimulated, setIsSimulated] = useState(false);

    // Fallback dev util - in real life user computes nullifier client side via Poseidon
    const handleInferNullifier = async () => {
        toast({ title: "Dev Tool", description: "In a full client, the Poseidon tree computes this locally.", variant: "default" });
    }

    const handleGenerateProof = async () => {
        if (!secret || !nullifier) {
            toast({ title: "Missing Data", description: "Provide both the secret and nullifier.", variant: "destructive" });
            return;
        }

        setProofLoading(true);
        try {
            // Calls the backend ZK generator. Will likely return simulated due to missing local prover.
            const res = await api.withdrawCommitment({ secret, nullifier, proof: "GENERATE" });

            setProofParams({
                nullifier_hash: nullifier,
                proof_data: res.status // simulated ID
            });

            if (res.status.includes('SIMULATED')) {
                setIsSimulated(true);
            }

            toast({ title: "Proof Generated", description: "ZK parameters constructed.", variant: "success" });
        } catch (e: any) {
            toast({ title: "Proof Failed", description: e.message || "API Error", variant: "destructive" });
        } finally {
            setProofLoading(false);
        }
    };

    const handleSubmitWithdrawal = async () => {
        if (!wallet || !wallet.account || !address || !proofParams) {
            toast({ title: "Cannot Proceed", description: "Missing wallet or proof.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {

            const withdrawCall = {
                contractAddress: VAULT_ADDRESS,
                entrypoint: "withdraw",
                calldata: CallData.compile({
                    nullifier_hash: proofParams.nullifier_hash,
                    proof_data: [proofParams.proof_data]
                })
            };

            const tx = await wallet.account.execute([withdrawCall]);

            toast({
                title: "Withdrawal Submitted!",
                description: `Starknet TX: ${tx.transaction_hash.slice(0, 10)}...`,
                variant: "success"
            });

        } catch (e: any) {
            toast({ title: "Transaction Failed", description: e.message || "Starknet Error", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">

            <div className="space-y-2 text-center pb-4">
                <h1 className="text-3xl font-bold tracking-tight">Withdraw Bitcoin</h1>
                <p className="text-zinc-400">Burn MockBTC and release native Bitcoin</p>
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
                                className="font-mono text-xs bg-zinc-950/50"
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
                                className="font-mono text-xs bg-zinc-950/50"
                                value={nullifier}
                                onChange={(e) => setNullifier(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-800">
                        <Button onClick={handleGenerateProof} disabled={proofLoading || !!proofParams} className="w-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                            {proofLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {proofParams ? "Proof Ready" : "Generate ZK Proof"}
                        </Button>
                    </div>

                    {proofParams && (
                        <div className="animate-in fade-in space-y-4 pt-4">
                            {isSimulated && (
                                <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm">
                                    <ShieldAlert className="h-5 w-5 shrink-0" />
                                    <p><strong>SIMULATED PROOF:</strong> The Cairo 0 Prover toolkit was not detected on the host backend. Operating in simulated demo mode to bypass the SHARP job queue.</p>
                                </div>
                            )}

                            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                                <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase tracking-wider font-semibold mb-2">
                                    <Cpu className="h-4 w-4" /> Proof Constructed
                                </div>
                                <div className="font-mono text-xs text-zinc-500 break-all">{proofParams.proof_data}</div>
                            </div>

                            <Button onClick={handleSubmitWithdrawal} disabled={loading || !wallet} className="w-full h-12 text-base">
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {wallet ? "Submit to Starknet" : "Connect Wallet First"}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    )}

                </CardContent>
            </Card>

        </div>
    );
}
