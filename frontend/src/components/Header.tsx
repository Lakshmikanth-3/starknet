"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "../app/context/WalletContext";
import { api } from "../lib/api";

export function Header() {
    const pathname = usePathname();
    const { wallet, address, connectWallet, disconnectWallet } = useWallet();
    const [blockNumber, setBlockNumber] = useState<number | null>(null);

    useEffect(() => {
        const fetchBlock = async () => {
            try {
                const health = await api.getHealth();
                setBlockNumber(health.starknet.blockNumber);
            } catch (e) {
                // fail silently
            }
        };

        fetchBlock();
        const interval = setInterval(fetchBlock, 12000);
        return () => clearInterval(interval);
    }, []);

    const truncateAddress = (addr: string) => {
        if (!addr) return "";
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <header>
            <Link href="/" className="logo">
                <div className="logo-icon"></div>
                <div className="logo-text">
                    <span>Private</span>BTC<span> Vault</span>
                </div>
            </Link>

            <nav>
                <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>Dashboard</Link>
                <Link href="/deposit" className={`nav-link ${pathname === '/deposit' ? 'active' : ''}`}>Deposit</Link>
                <Link href="/withdraw" className={`nav-link ${pathname === '/withdraw' ? 'active' : ''}`}>Withdraw</Link>
                <Link href="/audit" className={`nav-link ${pathname === '/audit' ? 'active' : ''}`}>Audit</Link>
            </nav>

            <div className="header-right">
                <div className="block-ticker">
                    <div className="block-dot"></div>
                    <span>SEPOLIA</span>
                    <span className="block-number">#{blockNumber || "---"}</span>
                    <div className="sync-bar"><div className="sync-fill"></div></div>
                </div>
                {address && wallet ? (
                    <button onClick={disconnectWallet} className="btn-connect">
                        ◈ {truncateAddress(address)}
                    </button>
                ) : (
                    <button onClick={connectWallet} className="btn-connect">
                        ◈ Connect Wallet
                    </button>
                )}
            </div>
        </header>
    );
}
