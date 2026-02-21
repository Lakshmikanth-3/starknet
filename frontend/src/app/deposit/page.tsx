"use client";

import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { Contract, CallData, uint256 } from "starknet";
import { Loader2, ArrowRight, ShieldCheck, Download, Bitcoin } from "lucide-react";

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || "";
const MOCKBTC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_BTC_ADDRESS || "";

export default function DepositPage() {
    const { wallet, address } = useWallet();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [amount, setAmount] = useState("");
    const [secret, setSecret] = useState("");

    // Step 1 Results
    const [commitment, setCommitment] = useState("");
    const [nullifierHash, setNullifierHash] = useState("");

    // Step 2 Results
    const [bitcoinTx, setBitcoinTx] = useState("");
    const [pollingSignet, setPollingSignet] = useState(false);

    // Constants
    const SIGNET_ADDRESS = "tb1qprivatebtcvaultdemopayloadxxsignet93xx";

    useEffect(() => {
        // Generate a random 31-byte hex for the secret on load
        // This ensures the value is always < Starknet field prime to avoid Pedersen out-of-range errors
        const randArray = new Uint8Array(31);
        crypto.getRandomValues(randArray);
        const hex = Array.from(randArray).map(b => b.toString(16).padStart(2, '0')).join('');
        setSecret("0x" + hex);
    }, []);

    const handleGenerateCommitment = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a valid BTC amount.", variant: "destructive" });
            return;
        }
        if (!secret) return;

        setLoading(true);
        try {
            // 1 BTC = 1e8 Sats (Using Satoshis)
            const sats = Math.floor(Number(amount) * 100000000).toString();
            // Backend expects { amount, secret } where amount is used as salt
            const res = await api.depositCommitment({ amount: sats, secret });
            setCommitment(res.commitment);
            setNullifierHash(res.nullifier_hash);
            setStep(2);
            toast({ title: "Commitment Generated", description: "Keep your secret safe.", variant: "success" });
        } catch (e: any) {
            toast({ title: "Failed to generate commitment", description: e.message || "API Error", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handlePollSignet = async () => {
        setPollingSignet(true);
        toast({ title: "Scanning Signet", description: "Looking for transactions on Bitcoin Signet...", variant: "default" });

        // Polling logic
        let attempts = 0;
        const interval = setInterval(async () => {
            try {
                const res = await api.detectLock();
                if (res.locked && res.transactionId) {
                    clearInterval(interval);
                    setBitcoinTx(res.transactionId);
                    setPollingSignet(false);
                    setStep(3);
                    toast({ title: "Deposit Detected!", description: `Found BTC TX: ${res.transactionId}`, variant: "success" });
                }
            } catch (e) {
                // Silent
            }

            attempts++;
            if (attempts >= 10) { // Timeout after 10 * 3s
                clearInterval(interval);
                setPollingSignet(false);
                toast({ title: "Timeout", description: "No transaction found yet. Please try again.", variant: "destructive" });
            }
        }, 3000);
    };

    const handleSubmitStarknet = async () => {
        if (!wallet || !wallet.account || !address) {
            toast({ title: "Wallet Not Connected", description: "Please connect Argent X or Braavos.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const sats = Math.floor(Number(amount) * 100000000);
            const parsedSats = uint256.bnToUint256(sats.toString());

            // Approve MockBTC
            const approveCall = {
                contractAddress: MOCKBTC_ADDRESS,
                entrypoint: "approve",
                calldata: CallData.compile({
                    spender: VAULT_ADDRESS,
                    amount: parsedSats
                })
            };

            // Interact with Vault Deposit
            // ABI: deposit(amount: u256, commitment: felt252)
            const depositCall = {
                contractAddress: VAULT_ADDRESS,
                entrypoint: "deposit",
                calldata: CallData.compile({
                    amount: parsedSats,
                    commitment: commitment
                })
            };

            const tx = await wallet.account.execute([approveCall, depositCall]);

            toast({
                title: "Transaction Submitted",
                description: `Starknet TX: ${tx.transaction_hash.slice(0, 10)}...`,
                variant: "success"
            });

            // Wait for completion (optional UX improvement)
            // await wallet.provider.waitForTransaction(tx.transaction_hash);

            setStep(4);
        } catch (e: any) {
            toast({ title: "Transaction Failed", description: e.message || "Starknet Error", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">

            <div className="space-y-2 text-center">
                <h1 className="text-3xl font-bold tracking-tight">Deposit Bitcoin</h1>
                <p className="text-zinc-400">Bridge native BTC into shielded Starknet assets</p>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center justify-between relative px-2">
                <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-full -translate-y-1/2 bg-zinc-800"></div>
                <div className="absolute left-0 top-1/2 -z-10 h-0.5 -translate-y-1/2 bg-btc-500 transition-all duration-500" style={{ width: `${(step - 1) * 33}%` }}></div>

                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 font-bold text-sm bg-zinc-950 transition-colors",
                        step >= i ? "border-btc-500 text-btc-500 bg-btc-500/10" : "border-zinc-800 text-zinc-600"
                    )}>
                        {i}
                    </div>
                ))}
            </div>

            {/* STEP 1 */}
            {step === 1 && (
                <Card className="border-btc-500/20 shadow-[0_0_30px_rgba(246,147,26,0.05)]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-btc-400" /> 1. Generate Privacy Commitment</CardTitle>
                        <CardDescription>We use Pedersen hashing to seal your deposit amount and secret before it touches the chain.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Bitcoin Amount</label>
                            <div className="relative">
                                <Bitcoin className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                                <Input
                                    type="number"
                                    className="pl-9 bg-zinc-950/50 text-lg font-mono border-zinc-800 focus-visible:ring-btc-500"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2 pt-2">
                            <label className="text-sm font-medium text-zinc-300">Withdrawal Secret (32-byte Hex)</label>
                            <Input
                                type="text"
                                className="font-mono text-xs text-zinc-500 bg-zinc-950/50"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                            />
                            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 mt-2">
                                <p className="text-xs text-yellow-500 font-medium">⚠️ SAVE THIS SECRET. If you lose this, you cannot withdraw your funds from the Vault. It acts as your private signing key for the ZK-circuit.</p>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                        <Button onClick={handleGenerateCommitment} disabled={loading} className="w-full sm:w-auto">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Generate Hash <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* STEP 2 */}
            {step === 2 && (
                <Card className="border-btc-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-btc-400" /> 2. Lock on Bitcoin Signet</CardTitle>
                        <CardDescription>Send exactly <strong className="text-zinc-100">{amount} BTC</strong> to the designated Signet Vault P2TR address.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
                            <div className="space-y-4">
                                <div>
                                    <div className="text-xs text-zinc-500 mb-1">Generated Commitment Hash</div>
                                    <div className="font-mono text-xs text-zinc-300 break-all bg-zinc-900 border border-zinc-800 px-2 py-1.5 rounded">{commitment}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-zinc-500 mb-1">Derived Nullifier Hash</div>
                                    <div className="font-mono text-xs text-zinc-300 break-all bg-zinc-900 border border-zinc-800 px-2 py-1.5 rounded">{nullifierHash}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 text-center p-6 border border-dashed border-zinc-700 bg-zinc-900/50 rounded-lg">
                            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Deposit Address (Signet)</p>
                            <p className="text-lg font-mono text-btc-400 break-all px-4">{SIGNET_ADDRESS}</p>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button onClick={handlePollSignet} disabled={pollingSignet} className="w-full">
                            {pollingSignet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {pollingSignet ? "Scanning mempool..." : "I've sent the BTC"}
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* STEP 3 */}
            {step === 3 && (
                <Card className="border-btc-500/20">
                    <CardHeader>
                        <CardTitle>3. Finalize on Starknet</CardTitle>
                        <CardDescription>Bitcoin lock detected. Submit the commitment to the Sepolia smart contract to mint your MockBTC.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-md bg-green-500/10 border border-green-500/20 p-4 space-y-2">
                            <div className="flex justify-between items-center border-b border-green-500/10 pb-2">
                                <span className="text-sm text-green-700/70">Bitcoin TXID</span>
                                <a href={`https://mempool.space/signet/tx/${bitcoinTx}`} target="_blank" className="font-mono text-xs text-green-500 hover:text-green-400">{bitcoinTx.slice(0, 16)}...</a>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-sm text-green-700/70">Matched Amount</span>
                                <span className="font-mono text-green-500 font-bold">{amount} sBTC</span>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button onClick={handleSubmitStarknet} disabled={loading || !wallet} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {wallet ? "Submit to Starknet" : "Connect Wallet to Submit"}
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* STEP 4 */}
            {step === 4 && (
                <Card className="border-green-500/20 bg-green-950/10 text-center py-8">
                    <CardContent className="space-y-4 flex flex-col items-center">
                        <div className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center mb-2 animate-bounce">
                            <ShieldCheck className="h-10 w-10 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-100">Deposit Successful!</h2>
                        <p className="text-zinc-400 max-w-sm">Your Bitcoin remains locked on Signet, and your shielded MockBTC has been minted to your Starknet account.</p>

                        <div className="pt-6">
                            <Button onClick={() => window.location.href = '/'} variant="outline">Return to Dashboard</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
