"use client";

import { useState, useEffect, useRef } from "react";
import { api, submitDeposit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { Loader2, ArrowRight, ShieldCheck, Download, Bitcoin, Wallet } from "lucide-react";
import { useXverseWallet } from "@/lib/useXverseWallet";

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || "";
const MOCKBTC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_BTC_ADDRESS || "";

export default function DepositPage() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [amount, setAmount] = useState("");
    const [secret, setSecret] = useState("");

    // Step 1 Results
    const [commitment, setCommitment] = useState("");
    const [nullifierHash, setNullifierHash] = useState("");

    // Step 2 Results
    const [bitcoinTx, setBitcoinTx] = useState("");

    // New accurate polling states
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [hasSentBTC, setHasSentBTC] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [confirmations, setConfirmations] = useState(0);

    // Step 3 API Flow
    const [vaultId, setVaultId] = useState<string>('');
    useEffect(() => { setVaultId(crypto.randomUUID()); }, []);
    const [txHash, setTxHash] = useState<string>('');
    const [voyagerUrl, setVoyagerUrl] = useState<string>('');
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [isWalletSending, setIsWalletSending] = useState(false);

    // Dynamic Address
    const [depositAddress, setDepositAddress] = useState<string>("Loading...");

    // Auto-broadcast availability check
    const [autoBroadcastAvailable, setAutoBroadcastAvailable] = useState(true);
    const [senderBalanceInfo, setSenderBalanceInfo] = useState<string | null>(null);

    // Xverse Wallet Integration
    const { 
        isConnected: walletConnected, 
        paymentAddress: walletAddress, 
        isConnecting: walletConnecting,
        error: walletError,
        connectWallet, 
        disconnectWallet, 
        sendBitcoin 
    } = useXverseWallet();

    // Check sender balance on mount
    useEffect(() => {
        const checkBroadcastAvailability = async () => {
            try {
                const balance = await api.checkSenderBalance();
                setAutoBroadcastAvailable(balance.canBroadcast);
                if (!balance.canBroadcast) {
                    setSenderBalanceInfo(balance.message);
                }
            } catch (error) {
                console.error('Failed to check sender balance:', error);
                // Assume available if check fails, will show error on actual broadcast
                setAutoBroadcastAvailable(true);
            }
        };
        checkBroadcastAvailability();
    }, []);

    // Polling Effect and cleanup
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // Manual Poll Trigger
    const startPolling = () => {
        setHasSentBTC(true);
        setIsScanning(true);
        setScanError(null);

        let attempts = 0;
        const MAX_ATTEMPTS = 180; // 180 × 5s = 15 minutes

        const poll = async () => {
            attempts++;
            console.log(`[Poll] Attempt ${attempts} — checking mempool...`);

            try {
                const result = await api.detectLock(
                    depositAddress, // The state we fetched directly in Step 1
                    parseFloat(amount)
                );

                console.log('[Poll] Response:', result);

                if (result.locked || (result as any).detected) {
                    // Success — stop polling and advance
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    setIsScanning(false);

                    const detectedTxid = result.transactionId || (result as any).txid || "";
                    setBitcoinTx(detectedTxid);
                    setConfirmations(result.confirmations || 0);
                    setVoyagerUrl(result.mempool_url || `https://mempool.space/signet/tx/${detectedTxid}`);
                    setStep(3);
                    toast({ title: "Deposit Detected!", description: `Found BTC TX: ${detectedTxid}`, variant: "success" });
                    return;
                }

                if (attempts >= MAX_ATTEMPTS) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setIsScanning(false);
                    setScanError('No transaction detected after 15 minutes — are you sure you sent to the right address?');
                    setHasSentBTC(false); // allow retry
                }
            } catch (err: any) {
                console.warn('[Poll] Warning:', err.message);
                if (attempts >= 10 && err.code === 'ERR_NETWORK') {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setIsScanning(false);
                    setScanError('Cannot connect to backend server. Is it running on port 3001?');
                    setHasSentBTC(false);
                }
            }
        };

        // Poll immediately then every 5 seconds
        poll();
        intervalRef.current = setInterval(poll, 5000);
    };

    const handleAutoSend = async () => {
        setIsBroadcasting(true);
        try {
            const res = await api.broadcastTx(amount);
            toast({
                title: "Transaction Broadcasted!",
                description: `TXID: ${res.txid}`,
                variant: "success"
            });
            startPolling();
        } catch (err: any) {
            toast({
                title: "Broadcast Failed",
                description: err.response?.data?.error || err.message,
                variant: "destructive"
            });
        } finally {
            setIsBroadcasting(false);
        }
    };

    // Send Bitcoin from connected Xverse wallet
    const handleWalletSend = async () => {
        if (!walletConnected || !walletAddress) {
            toast({
                title: "Wallet Not Connected",
                description: "Please connect your Xverse wallet first.",
                variant: "destructive"
            });
            return;
        }

        setIsWalletSending(true);
        let transactionSucceeded = false;
        let successTxid: string | null = null;
        
        try {
            const amountSats = Math.floor(parseFloat(amount) * 100_000_000);
            console.log(`[Deposit] Starting wallet send: ${amountSats} sats (${amount} BTC) to ${depositAddress}`);
            console.log(`[Deposit] From address: ${walletAddress}`);
            
            const txid = await sendBitcoin({
                toAddress: depositAddress,
                amountSats: amountSats
            });

            transactionSucceeded = true;
            successTxid = txid;
            console.log(`[Deposit] ✅ Transaction successful: ${txid}`);
            
            toast({
                title: "Bitcoin Sent Successfully! 🎉",
                description: `TXID: ${txid.slice(0, 16)}...`,
                variant: "success"
            });
            
            // Start polling for confirmation
            console.log('[Deposit] Starting mempool polling...');
            startPolling();
        } catch (err: any) {
            // Don't show error if transaction already succeeded (popup close after success)
            if (!transactionSucceeded) {
                console.error('[Deposit] ❌ Send failed:', err);
                console.error('[Deposit] Error details:', {
                    message: err.message,
                    stack: err.stack,
                    name: err.name
                });
                toast({
                    title: "Transaction Failed",
                    description: err.message || "Failed to send Bitcoin",
                    variant: "destructive"
                });
            } else {
                console.log(`[Deposit] ℹ️ Ignoring post-success error (txid: ${successTxid}):`, err.message);
            }
        } finally {
            setIsWalletSending(false);
            console.log('[Deposit] Wallet send flow completed. Success:', transactionSucceeded);
        }
    };

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

        if (loading) return; // prevent double-click
        setLoading(true);

        try {
            // Frontend validation succeeded. Send exactly { amount, secret } to backend.
            const res = await api.depositCommitment({ amount, secret: secret });

            if (!res.commitment || !res.nullifier_hash) {
                throw new Error("Backend did not return commitment and nullifier hashes.");
            }

            setCommitment(res.commitment);
            setNullifierHash(res.nullifier_hash);

            // Get the deposit address from the backend
            const btcStatus = await api.getDepositAddress(vaultId);
            if (!btcStatus.address) {
                throw new Error("Backend failed to provide a valid Signet deposit address. Check backend configuration.");
            }
            setDepositAddress(btcStatus.address);

            setStep(2);
            toast({ title: "Commitment Generated", description: "Keep your secret safe.", variant: "success" });
        } catch (e: any) {
            toast({ title: "Failed to generate commitment", description: e.message || "API Error", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };



    const handleSubmitStarknet = async () => {
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            console.log('[DEPOSIT] Calling backend relayer...');
            const response = await fetch('http://localhost:3001/api/commitment/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vault_id: vaultId,
                    commitment: commitment,
                    amount: Number(amount),
                    bitcoin_txid: bitcoinTx || undefined,
                    secret: secret,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Relayer submission failed');
            }

            const data = await response.json();
            console.log('[DEPOSIT] Relayer success:', data);

            setTxHash(data.transaction_hash);
            setVoyagerUrl(data.voyager_url || `https://sepolia.voyager.online/tx/${data.transaction_hash}`);
            setSubmitSuccess(true);
            setStep(4);

            toast({
                title: '✓ Global Shielding Initiated',
                description: 'Relayer has broadcasted your commitment to Starknet Sepolia.',
            });
        } catch (err: any) {
            setSubmitError(err.message);
            toast({
                title: '✗ Submission Failed',
                description: err.message,
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
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
                                <Input
                                    type="number"
                                    className="px-4 bg-zinc-900/80 text-2xl font-mono text-white border-zinc-700 h-14 focus-visible:ring-btc-500 focus-visible:border-btc-500 transition-all rounded-xl"
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
                                className="font-mono text-sm text-zinc-300 bg-zinc-900/80 border-zinc-700 h-12 focus-visible:ring-btc-500 focus-visible:border-btc-500 rounded-xl"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                            />
                            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 mt-2">
                                <p className="text-xs text-yellow-500 font-medium">⚠️ SAVE THIS SECRET. If you lose this, you cannot withdraw your funds from the Vault. It acts as your private signing key for the ZK-circuit.</p>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                        <Button
                            onClick={handleGenerateCommitment}
                            disabled={loading}
                            className="w-full sm:w-auto bg-btc-500 hover:bg-btc-400 text-black font-bold h-12 px-8 rounded-xl shadow-[0_0_15px_rgba(246,147,26,0.3)] transition-all"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loading ? 'Generating...' : 'Generate Hash →'}
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* STEP 2 */}
            {step === 2 && (
                <Card className="border-btc-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Bitcoin className="h-5 w-5 text-btc-400" /> 2. Send Real Bitcoin to Lock</CardTitle>
                        <CardDescription>
                            <strong className="text-zinc-100">Action Required:</strong> Send exactly <strong className="text-btc-400">{amount} BTC</strong> from your <strong className="text-orange-400">Xverse wallet</strong> (or any Bitcoin wallet) to the vault address below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-4">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-inner">
                            <div className="space-y-6">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Generated Commitment Hash</div>
                                    <div className="font-mono text-sm text-zinc-300 break-all bg-zinc-950 border border-zinc-800/50 px-4 py-3 rounded-lg">{commitment}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Derived Nullifier Hash</div>
                                    <div className="font-mono text-sm text-zinc-300 break-all bg-zinc-950 border border-zinc-800/50 px-4 py-3 rounded-lg">{nullifierHash}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 text-center p-8 border border-btc-500/30 bg-btc-500/5 rounded-xl shadow-[inset_0_0_20px_rgba(246,147,26,0.05)]">
                            <p className="text-xs font-bold text-btc-400/80 uppercase tracking-widest">Deposit Address (Signet)</p>
                            <p className="text-xl sm:text-2xl font-mono text-white break-all">{depositAddress}</p>
                        </div>

                        {/* How to Send Bitcoin Instructions */}
                        <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Bitcoin className="h-4 w-4 text-orange-400" />
                                <span className="text-sm font-bold text-orange-400">How to Send Bitcoin (BTC):</span>
                            </div>
                            <ol className="text-xs text-orange-200/80 space-y-2 list-decimal list-inside">
                                <li><strong className="text-orange-100">Open Xverse Wallet</strong> (or any Bitcoin wallet with Signet support)</li>
                                <li><strong className="text-orange-100">Make sure you're on Bitcoin Signet network</strong> (testnet)</li>
                                <li>Click <strong className="text-orange-100">"Send"</strong> and paste the vault address above: <code className="text-orange-200 text-[10px] bg-orange-900/30 px-1 py-0.5 rounded">tb1qgua8e...</code></li>
                                <li>Enter amount: <strong className="text-orange-100">{amount} BTC</strong></li>
                                <li><strong className="text-orange-100">Confirm and send</strong> the transaction</li>
                                <li>Wait 2-3 minutes, then click <strong className="text-orange-100">"I've manually sent the BTC"</strong> below</li>
                            </ol>
                            <div className="mt-3 pt-3 border-t border-orange-500/20">
                                <p className="text-xs text-orange-300/70">
                                    ℹ️ Need Signet BTC? Get test coins from: <a href="https://signetfaucet.com" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">signetfaucet.com</a>
                                </p>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3">
                        {/* Xverse Wallet Connection Section */}
                        <div className="w-full space-y-3">
                            {!walletConnected ? (
                                <div className="p-5 border-2 border-orange-500/40 bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-xl">
                                    <div className="flex items-center gap-3 mb-3">
                                        <Wallet className="h-5 w-5 text-orange-400" />
                                        <h3 className="text-sm font-bold text-orange-100">Connect Xverse Wallet</h3>
                                    </div>
                                    <p className="text-xs text-orange-200/70 mb-4">
                                        Connect your Xverse wallet to send Bitcoin directly from your browser without copying addresses!
                                    </p>
                                    <Button
                                        onClick={connectWallet}
                                        disabled={walletConnecting}
                                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold h-12 rounded-xl shadow-lg transition-all"
                                    >
                                        {walletConnecting ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...</>
                                        ) : (
                                            <><Wallet className="mr-2 h-4 w-4" /> Connect Xverse Wallet</>
                                        )}
                                    </Button>
                                    {walletError && (
                                        <p className="text-xs text-red-400 mt-2">{walletError}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="p-5 border-2 border-green-500/40 bg-gradient-to-br from-green-500/10 to-emerald-600/5 rounded-xl">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                                            <span className="text-xs font-semibold text-green-100">Wallet Connected</span>
                                        </div>
                                        <button
                                            onClick={disconnectWallet}
                                            className="text-xs text-zinc-400 hover:text-zinc-300 underline"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                    <div className="bg-zinc-950 border border-green-500/20 rounded-lg p-3 mb-4">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Payment Address</p>
                                        <p className="font-mono text-xs text-green-400 break-all">{walletAddress}</p>
                                    </div>
                                    {!hasSentBTC && (
                                        <>
                                            <Button
                                                onClick={handleWalletSend}
                                                disabled={isWalletSending}
                                                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold h-12 rounded-xl shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                {isWalletSending ? (
                                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Transaction...</>
                                                ) : (
                                                    <><Bitcoin className="mr-2 h-4 w-4" /> Send {amount} BTC from Wallet</>
                                                )}
                                            </Button>
                                            {isWalletSending && (
                                                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                                    <p className="text-xs text-blue-400 text-center">
                                                        <span className="font-semibold">ℹ️ Please wait...</span>
                                                        <br />
                                                        <span className="text-blue-300/80">You can close the Xverse popup after confirming. The transaction will continue processing in the background.</span>
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        {!hasSentBTC && (
                            <div className="flex items-center gap-3 w-full my-2">
                                <div className="flex-1 h-px bg-zinc-800"></div>
                                <span className="text-xs text-zinc-500 font-medium">OR</span>
                                <div className="flex-1 h-px bg-zinc-800"></div>
                            </div>
                        )}

                        {/* Warning if auto-broadcast is unavailable */}
                        {!autoBroadcastAvailable && senderBalanceInfo && (
                            <div className="w-full p-4 border border-orange-500/50 bg-orange-500/10 text-orange-400 text-sm rounded-xl flex items-start gap-3">
                                <span className="text-xl">⚠️</span>
                                <div className="flex-1 space-y-2">
                                    <p className="font-semibold">Auto-Broadcast Unavailable</p>
                                    <p className="text-xs text-orange-300">{senderBalanceInfo}</p>
                                    <p className="text-xs text-zinc-400 mt-2">
                                        Please use <strong>manual deposit</strong> by sending BTC from your own wallet to the address above, or fund the sender address at a Bitcoin Signet faucet.
                                    </p>
                                </div>
                            </div>
                        )}

                        {!hasSentBTC ? (
                            <div className="flex flex-col gap-3 w-full">
                                <Button
                                    onClick={handleAutoSend}
                                    disabled={isBroadcasting || !autoBroadcastAvailable}
                                    className="w-full bg-btc-500/10 hover:bg-btc-500/20 text-btc-400 border border-btc-500/30 font-bold h-12 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isBroadcasting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bitcoin className="mr-2 h-4 w-4" />}
                                    {isBroadcasting ? 'Broadcasting...' : !autoBroadcastAvailable ? 'Auto-Broadcast Unavailable' : 'Broadcast Real Signet BTC'}
                                </Button>
                                <Button onClick={startPolling} className="w-full bg-btc-500 hover:bg-btc-400 text-black font-bold h-12 rounded-xl shadow-[0_0_15px_rgba(246,147,26,0.3)] transition-all">
                                    I've manually sent the BTC
                                </Button>
                            </div>
                        ) : isScanning ? (
                            <Button disabled className="w-full bg-btc-500/50 text-black font-bold h-12 rounded-xl transition-all">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ⟳ Scanning mempool...
                            </Button>
                        ) : null}

                        {scanError && (
                            <div className="mt-4 p-4 border border-red-500/50 bg-red-500/10 text-red-500 text-sm rounded-lg text-center font-medium shadow-sm">
                                {scanError}
                            </div>
                        )}

                        {isScanning && (
                            <p className="text-center text-xs text-zinc-500 mt-2 font-medium">
                                It can take up to 2-3 minutes for the Signet transaction to appear. Please leave this page open.
                            </p>
                        )}
                    </CardFooter>
                </Card>
            )}

            {/* STEP 3 */}
            {step === 3 && (
                <Card className="border-btc-500/20">
                    <CardHeader>
                        <CardTitle>3. Bitcoin Locked - Finalize on Starknet</CardTitle>
                        <CardDescription>✅ Real Bitcoin transaction detected on Signet blockchain. Now mint sBTC tokens on Starknet to complete the bridge.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Bitcoin Transaction Proof */}
                        <div className="rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 p-5 space-y-4">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-sm font-bold text-green-400 uppercase tracking-wider">Bitcoin Transaction Confirmed</span>
                            </div>
                            
                            {/* Full TXID Display */}
                            <div className="space-y-2">
                                <div className="text-xs text-green-700/70 font-semibold uppercase tracking-wider">Real Bitcoin Transaction ID</div>
                                <div className="bg-zinc-950 border border-green-500/20 rounded-lg p-3 break-all">
                                    <a 
                                        href={`https://mempool.space/signet/tx/${bitcoinTx}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="font-mono text-xs text-green-400 hover:text-green-300 transition-colors"
                                    >
                                        {bitcoinTx}
                                    </a>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <a 
                                        href={`https://mempool.space/signet/tx/${bitcoinTx}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-green-500 hover:text-green-400 underline"
                                    >
                                        View on Mempool.space →
                                    </a>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-green-500/10">
                                <div>
                                    <div className="text-xs text-green-700/70 mb-1">Amount Locked</div>
                                    <div className="font-mono text-green-400 font-bold">{amount} BTC</div>
                                </div>
                                <div>
                                    <div className="text-xs text-green-700/70 mb-1">Confirmations</div>
                                    <div className="font-mono text-green-400 font-bold">{confirmations} {confirmations >= 1 ? '✓' : '⏳'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Explanation Box */}
                        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                            <div className="text-sm text-blue-400 font-semibold mb-2">📝 What Just Happened:</div>
                            <ol className="text-xs text-blue-300/80 space-y-1.5 list-decimal list-inside">
                                <li>You sent <strong className="text-blue-200">{amount} BTC</strong> from your <strong>Xverse wallet</strong> (or another wallet)</li>
                                <li>BTC arrived at vault address: <code className="text-blue-200 text-[10px]">tb1qgua8e...</code></li>
                                <li>Transaction confirmed on Bitcoin Signet blockchain (see txid above)</li>
                                <li>Now click below to mint <strong className="text-blue-200">{amount} sBTC</strong> tokens on Starknet</li>
                            </ol>
                        </div>

                        {submitError === 'INSUFFICIENT_GAS' && (
                            <div className="border border-orange-800 bg-orange-950/20 p-5 space-y-4">
                                <div className="font-mono text-orange-400 text-xs tracking-widest uppercase">
                                    ⚠ Starknet Account Needs Gas (Sepolia ETH)
                                </div>
                                <p className="font-mono text-xs text-zinc-400 leading-relaxed">
                                    Your Starknet account has insufficient Sepolia ETH to pay for gas.
                                    Use one of the faucets below to fund it, then retry.
                                </p>
                                <div className="space-y-2">
                                    {[
                                        {
                                            label: 'Starknet Faucet (Fastest)',
                                            url: 'https://starknet-faucet.vercel.app',
                                            note: '0.001 ETH — instant',
                                        },
                                        {
                                            label: 'Blast API Faucet (Backup)',
                                            url: 'https://blastapi.io/faucets/starknet-testnet-eth',
                                            note: 'Connect wallet required',
                                        },
                                        {
                                            label: 'Bridge from Ethereum Sepolia',
                                            url: 'https://sepolia.starkgate.starknet.io',
                                            note: 'Get ETH Sepolia first at sepoliafaucet.com',
                                        },
                                    ].map(f => (
                                        <a
                                            key={f.url}
                                            href={f.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between
                                                       border border-zinc-700 hover:border-orange-800
                                                       bg-zinc-900 px-4 py-3 transition-all group"
                                        >
                                            <div>
                                                <div className="font-mono text-xs text-zinc-300 
                                                                group-hover:text-orange-400 transition-colors">
                                                    ↗ {f.label}
                                                </div>
                                                <div className="font-mono text-xs text-zinc-600 mt-0.5">
                                                    {f.note}
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                                <button
                                    onClick={handleSubmitStarknet}
                                    className="w-full font-mono text-xs tracking-widest uppercase
                                               py-3 border border-orange-800 text-orange-400
                                               hover:bg-orange-950/30 transition-all"
                                >
                                    ↺ Retry After Funding
                                </button>
                            </div>
                        )}

                        {submitError && submitError !== 'INSUFFICIENT_GAS' && (
                            <div className="border border-red-800 bg-red-950/20 p-4 text-red-400 font-mono text-xs tracking-wide">
                                ✗ {submitError}
                            </div>
                        )}

                        {submitSuccess && txHash && (
                            <div className="border border-green-800 bg-green-950/20 p-5 space-y-4">
                                <div className="flex items-center gap-2 text-green-400 text-xs tracking-widest uppercase font-mono">
                                    <span>◈</span>
                                    <span>Transaction Submitted to Starknet</span>
                                </div>

                                <div className="bg-zinc-900 border border-zinc-800 p-3">
                                    <div className="text-zinc-500 text-xs tracking-widest uppercase mb-2 font-mono">
                                        Transaction Hash
                                    </div>
                                    <div className="font-mono text-orange-400 text-xs break-all">
                                        {txHash}
                                    </div>
                                </div>

                                {/* ZK Proof Status */}
                                <div className="flex items-center gap-2 bg-purple-950/20 border border-purple-700/40 rounded px-3 py-2">
                                    <svg className="h-3 w-3 text-purple-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    <span className="text-xs font-mono text-purple-300">
                                        Scarb 2.12.2 / Stwo prover generating ZK proof for your commitment…
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <a
                                        href={voyagerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-xs text-zinc-400 hover:text-orange-400 border border-zinc-700 hover:border-orange-800 px-4 py-2 transition-all"
                                    >
                                        ↗ Verify on Voyager
                                    </a>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(txHash);
                                            toast({ title: 'Hash copied to clipboard' });
                                        }}
                                        className="font-mono text-xs text-zinc-400 hover:text-orange-400 border border-zinc-700 hover:border-orange-800 px-4 py-2 transition-all"
                                    >
                                        ⧉ Copy Hash
                                    </button>
                                    <a
                                        href="/audit"
                                        className="font-mono text-xs text-orange-400 border border-orange-800 hover:bg-orange-950/30 px-4 py-2 transition-all"
                                    >
                                        → View in Audit Ledger
                                    </a>
                                </div>

                                <button
                                    onClick={() => {
                                        setStep(1);
                                        setTxHash('');
                                        setVoyagerUrl('');
                                        setSubmitSuccess(false);
                                        setCommitment('');
                                        setVaultId(crypto.randomUUID());
                                        setAmount('');
                                    }}
                                    className="font-mono text-xs text-zinc-500 hover:text-zinc-300 transition-colors tracking-widest uppercase"
                                >
                                    ↺ Start New Deposit
                                </button>
                            </div>
                        )}
                    </CardContent>
                    {!submitSuccess && (
                        <CardFooter className="flex justify-end">
                            <Button onClick={handleSubmitStarknet} disabled={isSubmitting} className="w-full bg-btc-500 hover:bg-btc-400 text-black font-bold h-12 rounded-xl shadow-[0_0_15px_rgba(246,147,26,0.3)] transition-all">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Submit to Starknet
                            </Button>
                        </CardFooter>
                    )}
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
                        <p className="text-zinc-400 max-w-sm">Your Bitcoin remains locked on Signet, and your shielded sBTC has been minted to your Starknet account.</p>

                        <div className="pt-6">
                            <Button onClick={() => window.location.href = '/'} variant="outline">Return to Dashboard</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
