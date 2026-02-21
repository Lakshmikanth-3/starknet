"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { connect, disconnect } from "starknetkit";

// Use a relaxed interface so starknetkit doesn't crash Next.js 14 strict compilation
interface WalletContextState {
    wallet: any | null;
    address: string | null;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextState>({
    wallet: null,
    address: null,
    connectWallet: async () => { },
    disconnectWallet: async () => { },
});

export const WalletProvider = ({ children }: { children: ReactNode }) => {
    const [wallet, setWallet] = useState<any | null>(null);
    const [address, setAddress] = useState<string | null>(null);

    const connectWallet = async () => {
        try {
            const { wallet: connectedWallet } = await connect({ modalMode: "alwaysAsk", modalTheme: "dark" });
            if (connectedWallet) {
                // @ts-ignore
                if (connectedWallet.isConnected) {
                    setWallet(connectedWallet);
                    // @ts-ignore
                    const addr = connectedWallet.selectedAddress || (connectedWallet.account && connectedWallet.account.address);
                    setAddress(addr || null);
                }
            }
        } catch (e) {
            console.error("Failed to connect wallet", e);
        }
    };

    const disconnectWallet = async () => {
        try {
            await disconnect({ clearLastWallet: true });
            setWallet(null);
            setAddress(null);
        } catch (e) {
            console.error("Failed to disconnect", e);
        }
    };

    useEffect(() => {
        const autoConnect = async () => {
            try {
                const { wallet: connectedWallet } = await connect({ modalMode: "neverAsk" });
                if (connectedWallet) {
                    // @ts-ignore
                    if (connectedWallet.isConnected) {
                        setWallet(connectedWallet);
                        // @ts-ignore
                        const addr = connectedWallet.selectedAddress || (connectedWallet.account && connectedWallet.account.address);
                        setAddress(addr || null);
                    }
                }
            } catch (e) {
                // Silent failure on autoconnect
            }
        };
        autoConnect();
    }, []);

    return (
        <WalletContext.Provider value={{ wallet, address, connectWallet, disconnectWallet }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => useContext(WalletContext);
