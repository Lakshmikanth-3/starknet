import React from "react";

export function Footer() {
    const VAULT_ADDR = process.env.NEXT_PUBLIC_VAULT_ADDRESS;
    const MOCKBTC_ADDR = process.env.NEXT_PUBLIC_MOCK_BTC_ADDRESS;

    return (
        <footer className="w-full border-t border-zinc-800 bg-zinc-950 py-8 text-zinc-400">
            <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-sm">
                    &copy; {new Date().getFullYear()} PrivateBTC Vault. All rights reserved.
                </div>

                <div className="flex flex-col text-xs space-y-1 text-center md:text-right">
                    <div>
                        <span className="text-zinc-500">Vault Contract:</span>{" "}
                        <a
                            href={`https://sepolia.voyager.online/contract/${VAULT_ADDR}`}
                            target="_blank" rel="noreferrer"
                            className="font-mono hover:text-btc-400 transition"
                        >
                            {VAULT_ADDR}
                        </a>
                    </div>
                    <div>
                        <span className="text-zinc-500">Shielded Asset (sBTC):</span>{" "}
                        <a
                            href={`https://sepolia.voyager.online/contract/${MOCKBTC_ADDR}`}
                            target="_blank" rel="noreferrer"
                            className="font-mono hover:text-btc-400 transition"
                        >
                            {MOCKBTC_ADDR}
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
