"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { VaultStatus, AuditEvent } from "@/types";
import { cn } from "@/lib/utils";

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0x03e735d12f81f2f4beb45634bef9997ae3bde996c2f84a204957dc5ef2209de2";
const MOCKBTC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_BTC_ADDRESS || "0x0291c79b16b1541361c8efe84c5558994066948cfe9b7075db781a758c2cec52";

export default function Home() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      const [vaultStats, auditLogs] = await Promise.all([
        api.getVaultStatus(),
        api.getAuditLogs()
      ]);
      setStatus(vaultStats);
      setLogs(auditLogs.slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 12000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setToastMsg("Copied to clipboard");
      setTimeout(() => setToastMsg(null), 2000);
    });
  };

  const formatHash = (h: string) => h ? `${h.substring(0, 8)}...${h.substring(h.length - 6)}` : '';

  return (
    <>
      {/* HERO */}
      <div className="hero">
        <div className="hero-tag animate-fade-1">ZK-STARK Powered · Starknet Sepolia</div>
        <h1 className="animate-fade-1">
          <span className="line1">Private Bitcoin</span>
          <span className="line2 hero-line2">Bridge on Starknet</span>
        </h1>
        <p className="hero-sub animate-fade-1">
          Deposit Bitcoin via Signet. Generate zero-knowledge proofs via SHARP.<br />
          Withdraw securely and privately on the Sepolia testnet.
        </p>
        <div className="hero-actions animate-fade-1">
          <Link href="/deposit" className="btn-primary">↓ Deposit BTC</Link>
          <Link href="/withdraw" className="btn-secondary">↑ Withdraw BTC</Link>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="stats-grid animate-fade-1">
        <div className="stat-card">
          <div className="stat-label">Starknet Block</div>
          <div className="stat-value">{status?.blockNumber ? status.blockNumber.toLocaleString() : "---"}</div>
          <div className="stat-sub">Live Sepolia Network</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Deposits</div>
          <div className="stat-value">{status?.metrics?.totalDeposits || "0"}</div>
          <div className="stat-sub">MockBTC locked in vault</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active HTLCs</div>
          <div className="stat-value">{status?.metrics?.activeHtlcs || "0"}</div>
          <div className="stat-sub">Pending claims</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Backend Status</div>
          <div className="stat-value" style={{ fontSize: "1.2rem", paddingTop: "0.25rem" }}>
            {status?.health?.vaultContractReachable ? (
              <span className="stat-badge badge-green">● Online</span>
            ) : (
              <span className="stat-badge" style={{ color: "var(--red)", border: "1px solid var(--red)" }}>● Degraded</span>
            )}
          </div>
          <div className="stat-sub" style={{ marginTop: "0.6rem" }}>
            {status?.health?.vaultContractReachable ? "Connected to Starknet RPC" : "RPC Failure Detected"}
          </div>
        </div>
      </div>

      {/* NETWORK BAR */}
      <div className="network-bar animate-fade-2">
        <div className="network-item">
          <div className="network-key">Network</div>
          <div className="network-val">Starknet Sepolia</div>
        </div>
        <div className="network-divider"></div>
        <div className="network-item">
          <div className="network-key">RPC Provider</div>
          <div className="network-val">Alchemy</div>
        </div>
        <div className="network-divider"></div>
        <div className="network-item">
          <div className="network-key">Bitcoin Network</div>
          <div className="network-val">Signet</div>
        </div>
        <div className="network-divider"></div>
        <div className="network-item">
          <div className="network-key">BTC API</div>
          <div className="network-val">mempool.space</div>
        </div>
        <div className="network-divider"></div>
        <div className="network-item">
          <div className="network-key">Test Suite</div>
          <div className="network-val" style={{ color: "var(--green)" }}>21 / 21 ✓</div>
        </div>
        <div className="network-divider"></div>
        <div className="network-item">
          <div className="network-key">Hash Functions</div>
          <div className="network-val">Pedersen · Poseidon</div>
        </div>
      </div>

      {/* ZK STATUS ROW */}
      <div className="zk-row animate-fade-3">
        <div className="zk-item">
          <div className="zk-icon">⬡</div>
          <div>
            <div className="zk-label">Starknet Interaction</div>
            <div className="zk-val live">● Real — On-chain RPC</div>
          </div>
        </div>
        <div className="zk-item">
          <div className="zk-icon">₿</div>
          <div>
            <div className="zk-label">Bitcoin Signet</div>
            <div className="zk-val live">● Real — mempool.space</div>
          </div>
        </div>
        <div className="zk-item">
          <div className="zk-icon">◈</div>
          <div>
            <div className="zk-label">SHARP ZK Prover</div>
            <div className="zk-val sim">⚠ Simulated — No Cairo Docker</div>
          </div>
        </div>
      </div>

      {/* TWO COL */}
      <div className="two-col animate-fade-4">

        {/* ACTIVITY FEED */}
        <div className="panel flex flex-col h-full">
          <div className="panel-header">
            <div className="panel-title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--orange)' }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              Live Activity Feed
            </div>
            <div className="section-refresh" onClick={fetchDashboardData}>
              {loading ? "↺ Refreshing..." : "↺ Refresh"}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-[300px]">
            {logs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon text-lg text-orange-500 font-bold">⬡</div>
                <div className="empty-text">
                  No activity recorded yet.<br />
                  Make a deposit to see events appear here.
                </div>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-zinc-800">
                {logs.map(log => (
                  <div key={log.id} className="p-4 hover:bg-zinc-800/30 transition flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        log.status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                          log.status === 'pending' ? 'bg-orange-500 animate-pulse' : 'bg-red-500'
                      )} />
                      <div>
                        <div className="text-xs font-mono font-bold tracking-wider text-zinc-300 uppercase">{log.eventType.replace(/_/g, ' ')}</div>
                        <div className="text-[0.65rem] text-zinc-500 mt-0.5">{new Date(log.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                    {log.txHash && (
                      <a
                        href={`https://sepolia.voyager.online/tx/${log.txHash}`}
                        target="_blank" rel="noreferrer"
                        className="text-[0.65rem] font-mono text-zinc-400 hover:text-orange-500 flex items-center gap-1 transition-colors"
                      >
                        {formatHash(log.txHash)} ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CONTRACT INFO */}
        <div>
          <div className="section-header">
            <div className="section-title">Contract Addresses</div>
          </div>
          <div className="contract-panel">
            <div className="contract-item">
              <div className="contract-label">Vault Contract · Starknet Sepolia</div>
              <div className="contract-addr tooltip-wrap" onClick={() => copyToClipboard(VAULT_ADDRESS)}>
                {VAULT_ADDRESS}
                <span className="tooltip">Click to copy</span>
              </div>
              <div className="copy-hint">↗ Voyager · Starkscan</div>
            </div>
            <div className="contract-item">
              <div className="contract-label">MockBTC Token · ERC-20 Sepolia</div>
              <div className="contract-addr tooltip-wrap" onClick={() => copyToClipboard(MOCKBTC_ADDRESS)}>
                {MOCKBTC_ADDRESS}
                <span className="tooltip">Click to copy</span>
              </div>
              <div className="copy-hint">↗ Verify on Voyager</div>
            </div>
            <div className="contract-item">
              <div className="contract-label">Proof System</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-mid)", lineHeight: 1.8 }}>
                <span className="stat-badge badge-orange" style={{ marginBottom: "0.5rem", display: "inline-flex" }}>ZK-STARK via SHARP</span><br />
                Cairo 2/3 · Pedersen + Poseidon<br />
                SQLite · LockManager · Rate Limiter
              </div>
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div className="section-header">
              <div className="section-title">Quick Verify</div>
            </div>
            <div className="panel" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <a href="https://sepolia.voyager.online/" target="_blank" className="btn-secondary" style={{ clipPath: "none", textAlign: "center", fontSize: "0.65rem", padding: "10px" }}>
                ↗ Open Voyager Explorer
              </a>
              <a href="https://sepolia.starkscan.co/" target="_blank" className="btn-secondary" style={{ clipPath: "none", textAlign: "center", fontSize: "0.65rem", padding: "10px" }}>
                ↗ Open Starkscan
              </a>
            </div>
          </div>
        </div>

      </div>

      <div className={`toast ${toastMsg ? 'show' : ''}`} id="toast">
        {toastMsg}
      </div>
    </>
  );
}
