import { RpcProvider, Account, cairo } from 'starknet';
import * as dotenv from 'dotenv';
dotenv.config();

async function preflight() {
    console.log('\n═══════════════════════════════════');
    console.log('  NULLVAULT PREFLIGHT CHECK');
    console.log('═══════════════════════════════════\n');

    const results: Array<{ check: string; status: string; fix?: string }> = [];

    // ── Check 1: SEPOLIA_PRIVATE_KEY exists
    const privateKey = process.env.SEPOLIA_PRIVATE_KEY;
    const accountAddress = process.env.STARKNET_ACCOUNT_ADDRESS;
    if (!privateKey || !accountAddress) {
        results.push({
            check: 'Starknet credentials',
            status: '✗ FAIL',
            fix: 'Add SEPOLIA_PRIVATE_KEY and STARKNET_ACCOUNT_ADDRESS to backend/.env\n' +
                'Get them from your Argent X or Braavos wallet → Settings → Export'
        });
    } else {
        results.push({ check: 'Starknet credentials', status: '✓ PASS' });
    }

    // ── Check 2: Starknet RPC reachable
    try {
        const provider = new RpcProvider({
            nodeUrl: process.env.STARKNET_RPC_URL!
        });
        const block = await provider.getBlockNumber();
        results.push({
            check: `Starknet RPC (block #${block})`,
            status: '✓ PASS'
        });

        // ── Check 3: Sepolia ETH balance
        if (privateKey && accountAddress) {
            const ETH_ADDRESS =
                '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
            const account = new Account(provider, accountAddress, privateKey);
            const balance = await provider.callContract({
                contractAddress: ETH_ADDRESS,
                entrypoint: 'balanceOf',
                calldata: [accountAddress],
            });
            const balanceWei = BigInt(balance[0]);
            const balanceEth = Number(balanceWei) / 1e18;
            const MIN_ETH = 0.001;

            if (balanceEth < MIN_ETH) {
                results.push({
                    check: `Sepolia ETH balance (${balanceEth.toFixed(6)} ETH)`,
                    status: '✗ FAIL — INSUFFICIENT GAS',
                    fix:
                        '════════════════════════════════════════\n' +
                        '  HOW TO GET SEPOLIA ETH FOR GAS\n' +
                        '════════════════════════════════════════\n' +
                        '  Option 1 (Fastest):\n' +
                        '  → https://starknet-faucet.vercel.app\n' +
                        '  → Paste your Starknet account address\n' +
                        '  → Receive 0.001 Sepolia ETH (instant)\n\n' +
                        '  Option 2 (Backup):\n' +
                        '  → https://blastapi.io/faucets/starknet-testnet-eth\n' +
                        '  → Connect wallet → Request ETH\n\n' +
                        '  Option 3 (Bridge from Ethereum Sepolia):\n' +
                        '  → Get Ethereum Sepolia ETH from https://sepoliafaucet.com\n' +
                        '  → Bridge to Starknet at https://sepolia.starkgate.starknet.io\n\n' +
                        `  Your account: ${accountAddress}\n` +
                        `  Current balance: ${balanceEth.toFixed(6)} ETH\n` +
                        `  Required minimum: ${MIN_ETH} ETH\n` +
                        '════════════════════════════════════════\n' +
                        '  STOP: Fund your account then re-run preflight'
                });
            } else {
                results.push({
                    check: `Sepolia ETH balance (${balanceEth.toFixed(6)} ETH)`,
                    status: '✓ PASS'
                });
            }
        }
    } catch (err) {
        results.push({
            check: 'Starknet RPC',
            status: '✗ FAIL',
            fix: 'Check STARKNET_RPC_URL in .env\n' +
                'Verify Alchemy app is active at https://dashboard.alchemy.com'
        });
    }

    // ── Check 4: Bitcoin Signet address configured
    const signetAddress = process.env.XVERSE_WALLET_ADDRESS;
    if (!signetAddress || !signetAddress.startsWith('tb1')) {
        results.push({
            check: 'Xverse Signet address',
            status: '✗ FAIL',
            fix: 'Add XVERSE_WALLET_ADDRESS=tb1qhkjy7mc9nwg3rtnjapuqg5xczc50nv6ysm5ak8 to .env'
        });
    } else {
        results.push({ check: `Xverse address (${signetAddress})`, status: '✓ PASS' });
    }

    // ── Check 5: mempool.space Signet API reachable
    try {
        const res = await fetch('https://mempool.space/signet/api/blocks/tip/height');
        const height = await res.json();
        results.push({ check: `Signet API (block #${height})`, status: '✓ PASS' });
    } catch {
        results.push({
            check: 'Signet API (mempool.space)',
            status: '✗ FAIL',
            fix: 'No internet access to mempool.space/signet — check network'
        });
    }

    // ── Check 6: Vault + sBTC contracts exist on-chain
    try {
        const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL! });
        const vaultClass = await provider.getClassHashAt(process.env.VAULT_ADDRESS!);
        results.push({
            check: `Vault contract (${process.env.VAULT_ADDRESS?.slice(0, 12)}...)`,
            status: vaultClass ? '✓ PASS' : '✗ FAIL'
        });
    } catch {
        results.push({
            check: 'Vault contract on-chain',
            status: '✗ FAIL',
            fix: 'Verify VAULT_ADDRESS in .env matches deployed contract on Voyager:\n' +
                'https://sepolia.voyager.online/contract/' + process.env.VAULT_ADDRESS
        });
    }

    // ── Print results
    console.log('PREFLIGHT RESULTS:\n');
    let allPassed = true;
    for (const r of results) {
        console.log(`  ${r.status}  ${r.check}`);
        if (r.fix) {
            console.log('\n' + r.fix + '\n');
            allPassed = false;
        }
    }

    if (!allPassed) {
        console.log('\n═══════════════════════════════════');
        console.log('  PREFLIGHT FAILED — fix issues above before proceeding');
        console.log('═══════════════════════════════════\n');
        process.exit(1);
    }

    console.log('\n═══════════════════════════════════');
    console.log('  ALL CHECKS PASSED — safe to proceed');
    console.log('═══════════════════════════════════\n');
}

preflight();
